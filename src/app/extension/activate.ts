import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LogStore } from "../../features/logs/extension";
import { RecentBranchesProvider } from "../../features/branches/extension";
import { RecentBranchesWebviewProvider } from "../../features/webview/extension";
import { PullRequestsProvider } from "../../features/pull-requests/extension";
import type { GitAPI, GitExtensionExports, Repository } from "../../shared/extension";
import { GitTerminalExecutor, type TerminalDispatchResult } from "./GitTerminalExecutor";

interface ExtensionPackageJson {
  version?: unknown;
  robdevBuildCode?: unknown;
}

interface GitCommandTemplates {
  switchBranch: string;
  pullFromOrigin: string;
  mergeFromBase: string;
}

type ExecFileAsync = (
  file: string,
  args: string[],
  options: { cwd: string }
) => Promise<{ stdout: string; stderr: string }>;

const DEFAULT_GIT_COMMAND_TEMPLATES: GitCommandTemplates = {
  switchBranch: "git checkout {{targetBranch}}",
  pullFromOrigin: "git pull",
  mergeFromBase: "git merge {{baseBranch}}"
};

async function activate(context: vscode.ExtensionContext) {
  const execFileAsync = promisify(execFile) as unknown as ExecFileAsync;
  const gitApi = await getGitApi();
  if (!gitApi) {
    return;
  }
  const api = gitApi;

  const logStore = new LogStore();
  const provider = new RecentBranchesProvider(context.workspaceState, logStore);
  const pullRequestsProvider = new PullRequestsProvider(logStore);
  const extensionPackageJson = context.extension.packageJSON as ExtensionPackageJson;
  const extensionVersion = typeof extensionPackageJson.version === "string" ? extensionPackageJson.version : "unknown";
  const extensionBuildCode =
    typeof extensionPackageJson.robdevBuildCode === "string" ? extensionPackageJson.robdevBuildCode : "dev";
  const webviewProvider = new RecentBranchesWebviewProvider(
    provider,
    pullRequestsProvider,
    logStore,
    context.extensionUri,
    context.workspaceState,
    extensionVersion,
    extensionBuildCode
  );
  const webviewDisposable = vscode.window.registerWebviewViewProvider("rd-git.view", webviewProvider, {
    webviewOptions: {
      retainContextWhenHidden: true
    }
  });
  context.subscriptions.push(webviewDisposable);
  context.subscriptions.push(webviewProvider);
  const gitTerminalExecutor = new GitTerminalExecutor();
  context.subscriptions.push(gitTerminalExecutor);

  function setGitOperationInProgress(action: "pullFromOrigin" | "mergeFromBase", notice: string) {
    webviewProvider.setGitOperationState({
      isInProgress: true,
      action,
      terminalName: gitTerminalExecutor.getTerminalName(),
      notice
    });
  }

  function setGitOperationIdle(notice: string) {
    webviewProvider.setGitOperationState({
      isInProgress: false,
      action: undefined,
      terminalName: gitTerminalExecutor.getTerminalName(),
      notice
    });
  }

  function logTerminalDispatchResult(actionLabel: string, command: string, result: TerminalDispatchResult) {
    if (result.ok) {
      const lifecycleLabel = result.lifecycle === "created" ? "created" : "reused";
      logStore.info(
        "commands",
        `${actionLabel}: terminal '${result.terminalName}' ${lifecycleLabel}; command dispatched.`
      );
      logStore.info("git", `$ ${command}`);
      return;
    }

    const failedStep = result.failedStep ?? "unknown";
    const details = result.errorMessage ?? "Unknown terminal dispatch error.";
    logStore.error(
      "commands",
      `${actionLabel}: terminal dispatch failed at '${failedStep}' for '${result.terminalName}'. ${details}`
    );
  }

  const repositorySubscriptions = new Map<string, vscode.Disposable>();

  function getCurrentRepository() {
    const active = provider.getRepository();
    if (active) {
      return active;
    }

    return api.repositories[0];
  }

  async function updateCurrentBranchMru(repository: Repository) {
    const headName = repository.state.HEAD?.name;
    if (!headName) {
      return;
    }

    const previous = provider.getRepository();
    provider.setRepository(repository);
    await provider.updateMruBranch(headName);
    if (previous !== repository) {
      provider.setRepository(previous ?? repository);
    }
    provider.refresh();
  }

  function subscribeToRepository(repository: Repository) {
    const key = repository.rootUri.fsPath;
    if (repositorySubscriptions.has(key)) {
      return;
    }

    const disposable = repository.state.onDidChange(() => {
      void updateCurrentBranchMru(repository);
    });
    repositorySubscriptions.set(key, disposable);
    context.subscriptions.push(disposable);
  }

  function refreshRepositorySelection() {
    const repo = api.repositories[0];
    provider.setRepository(repo);
    pullRequestsProvider.setRepository(repo);
  }

  for (const repository of api.repositories) {
    subscribeToRepository(repository);
  }
  refreshRepositorySelection();
  const initialRepo = getCurrentRepository();
  if (initialRepo) {
    void updateCurrentBranchMru(initialRepo);
  }

  const openRepoDisposable = api.onDidOpenRepository((repository) => {
    subscribeToRepository(repository);
    refreshRepositorySelection();
    void updateCurrentBranchMru(repository);
  });
  const closeRepoDisposable = api.onDidCloseRepository((repository) => {
    const key = repository.rootUri.fsPath;
    const disposable = repositorySubscriptions.get(key);
    if (disposable) {
      disposable.dispose();
      repositorySubscriptions.delete(key);
    }
    refreshRepositorySelection();
    provider.refresh();
  });
  const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
    refreshRepositorySelection();
  });
  const authSessionsDisposable = vscode.authentication.onDidChangeSessions((event) => {
    if (!event.provider.id || event.provider.id !== "github") {
      return;
    }
    logStore.info("auth", "GitHub auth sessions changed; refreshing pull requests.");
    pullRequestsProvider.refresh();
  });

  const switchBranchDisposable = vscode.commands.registerCommand(
    "rd-git.switchBranch",
    async (branchName: string) => {
      const repository = getCurrentRepository();
      if (!repository) {
        logStore.warn("commands", "Switch branch requested with no available repository.");
        return;
      }

      try {
        const targetBranch = normalizeBranchName(branchName);
        if (!targetBranch) {
          logStore.warn("commands", "Could not determine target branch for switch.");
          return;
        }

        if (!isShellSafeGitRef(targetBranch)) {
          throw new Error(
            `Branch '${targetBranch}' has unsupported characters for terminal dispatch. Run switch manually in terminal.`
          );
        }

        const templates = getGitCommandTemplates();
        const command = renderGitCommandTemplate(
          templates.switchBranch,
          {
            targetBranch
          },
          DEFAULT_GIT_COMMAND_TEMPLATES.switchBranch,
          "switchBranch",
          logStore
        );
        const dispatchResult = gitTerminalExecutor.runCommand(repository.rootUri.fsPath, command);
        logTerminalDispatchResult(`Switch to '${targetBranch}'`, command, dispatchResult);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logStore.error("commands", `Failed to switch branch: ${message}`);
      }
    }
  );

  const pullFromOriginDisposable = vscode.commands.registerCommand(
    "rd-git.pullFromOrigin",
    async (branchArg: string | { branchName?: string }) => {
      const repository = getCurrentRepository();
      if (!repository) {
        logStore.warn("commands", "Pull from origin requested with no available repository.");
        return;
      }

      let hasStarted = false;
      try {
        const targetBranch = normalizeBranchName(getBranchName(branchArg));
        if (!targetBranch) {
          logStore.warn("commands", "Could not determine target branch for pull from origin.");
          return;
        }

        setGitOperationInProgress(
          "pullFromOrigin",
          `Starting pull for '${targetBranch}' in terminal '${gitTerminalExecutor.getTerminalName()}'.`
        );

        const currentBranch = normalizeBranchName(repository.state.HEAD?.name ?? "");
        const templates = getGitCommandTemplates();
        const switchCommand = renderGitCommandTemplate(
          templates.switchBranch,
          {
            targetBranch
          },
          DEFAULT_GIT_COMMAND_TEMPLATES.switchBranch,
          "switchBranch",
          logStore
        );
        const pullCommand = renderGitCommandTemplate(
          templates.pullFromOrigin,
          {
            targetBranch
          },
          DEFAULT_GIT_COMMAND_TEMPLATES.pullFromOrigin,
          "pullFromOrigin",
          logStore
        );

        let commandToRun = pullCommand;
        if (currentBranch !== targetBranch) {
          commandToRun = `${switchCommand} && ${pullCommand}`;
          logStore.info("commands", `Will switch to '${targetBranch}' before pull.`);
        }

        const dispatchResult = gitTerminalExecutor.runCommand(repository.rootUri.fsPath, commandToRun);
        if (!dispatchResult.ok) {
          logTerminalDispatchResult(`Pull '${targetBranch}'`, commandToRun, dispatchResult);
          return;
        }
        hasStarted = true;
        logTerminalDispatchResult(`Pull '${targetBranch}'`, commandToRun, dispatchResult);
        await updateCurrentBranchMru(repository);
        logStore.info(
          "commands",
          "Watch terminal output for merge conflicts, auth prompts, and completion status."
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logStore.error("commands", `Pull from origin failed: ${message}`);
        logStore.warn(
          "commands",
          `If a command was started, continue in terminal '${gitTerminalExecutor.getTerminalName()}' and use Logs tab for history.`
        );
      } finally {
        if (hasStarted) {
          setGitOperationIdle(
            `Pull command sent to '${gitTerminalExecutor.getTerminalName()}'. Watch terminal output for prompts/conflicts; Logs tab keeps history.`
          );
        }
      }
    }
  );

  const mergeFromBaseDisposable = vscode.commands.registerCommand(
    "rd-git.mergeFromBase",
    async (branchArg: string | { branchName?: string }) => {
      const repository = getCurrentRepository();
      if (!repository) {
        logStore.warn("commands", "Merge from base requested with no available repository.");
        return;
      }

      let hasStarted = false;
      try {
        const targetBranch = normalizeBranchName(getBranchName(branchArg));
        if (!targetBranch) {
          logStore.warn("commands", "Could not determine target branch for merge from base.");
          return;
        }

        setGitOperationInProgress(
          "mergeFromBase",
          `Starting merge in terminal '${gitTerminalExecutor.getTerminalName()}'.`
        );

        const baseBranch = await resolveBaseBranch(repository, execFileAsync, logStore);
        const currentBranch = normalizeBranchName(repository.state.HEAD?.name ?? "");
        const templates = getGitCommandTemplates();
        const switchCommand = renderGitCommandTemplate(
          templates.switchBranch,
          {
            targetBranch
          },
          DEFAULT_GIT_COMMAND_TEMPLATES.switchBranch,
          "switchBranch",
          logStore
        );
        const mergeCommand = renderGitCommandTemplate(
          templates.mergeFromBase,
          {
            targetBranch,
            baseBranch
          },
          DEFAULT_GIT_COMMAND_TEMPLATES.mergeFromBase,
          "mergeFromBase",
          logStore
        );

        if (!isShellSafeGitRef(baseBranch) || !isShellSafeGitRef(targetBranch)) {
          throw new Error(
            `Base branch '${baseBranch}' has unsupported characters for terminal dispatch. Run merge manually in terminal.`
          );
        }

        let commandToRun = mergeCommand;
        if (currentBranch !== targetBranch) {
          commandToRun = `${switchCommand} && ${mergeCommand}`;
          logStore.info("commands", `Will switch to '${targetBranch}' before merge.`);
        }

        const dispatchResult = gitTerminalExecutor.runCommand(repository.rootUri.fsPath, commandToRun);
        if (!dispatchResult.ok) {
          logTerminalDispatchResult(
            `Merge '${baseBranch}' into '${targetBranch}'`,
            commandToRun,
            dispatchResult
          );
          return;
        }
        hasStarted = true;
        logTerminalDispatchResult(
          `Merge '${baseBranch}' into '${targetBranch}'`,
          commandToRun,
          dispatchResult
        );
        await updateCurrentBranchMru(repository);
        logStore.info(
          "commands",
          "Resolve merge conflicts in the terminal. After resolving, run git add + git merge --continue (or git merge --abort)."
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logStore.error("commands", `Merge failed: ${message}`);
        logStore.warn(
          "commands",
          `If a command was started, continue in terminal '${gitTerminalExecutor.getTerminalName()}' and use Logs tab for history.`
        );
      } finally {
        if (hasStarted) {
          setGitOperationIdle(
            `Merge command sent to '${gitTerminalExecutor.getTerminalName()}'. Resolve prompts/conflicts there, then refresh. Logs tab keeps history.`
          );
        }
      }
    }
  );

  const mergePullRequestDisposable = vscode.commands.registerCommand(
    "rd-git.mergePullRequest",
    async (pullRequestId: number) => {
      const result = await pullRequestsProvider.mergePullRequest(pullRequestId);
      if (result.ok) {
        logStore.info("commands", result.message);
      } else {
        logStore.error("commands", result.message);
      }
      pullRequestsProvider.refresh();
    }
  );

  const markPullRequestReadyDisposable = vscode.commands.registerCommand(
    "rd-git.markPullRequestReady",
    async (pullRequestId: number) => {
      const result = await pullRequestsProvider.markPullRequestReady(pullRequestId);
      if (result.ok) {
        logStore.info("commands", result.message);
      } else {
        logStore.error("commands", result.message);
      }
      pullRequestsProvider.refresh();
    }
  );

  const signInGithubDisposable = vscode.commands.registerCommand("rd-git.signInGithub", async () => {
    const didSignIn = await pullRequestsProvider.signIn();
    if (!didSignIn) {
      logStore.warn("auth", "GitHub sign-in was canceled or unavailable.");
    }
    pullRequestsProvider.refresh();
  });

  const switchGithubAccountDisposable = vscode.commands.registerCommand(
    "rd-git.switchGithubAccount",
    async () => {
      const didSwitch = await pullRequestsProvider.switchAccount();
      if (!didSwitch) {
        logStore.warn("auth", "GitHub account switch was canceled or unavailable.");
      }
      pullRequestsProvider.refresh();
    }
  );

  const openGithubAccountsDisposable = vscode.commands.registerCommand(
    "rd-git.openGithubAccounts",
    async () => {
      await pullRequestsProvider.openGitHubAccountsMenu();
      pullRequestsProvider.refresh();
    }
  );

  context.subscriptions.push(openRepoDisposable);
  context.subscriptions.push(closeRepoDisposable);
  context.subscriptions.push(activeEditorDisposable);
  context.subscriptions.push(authSessionsDisposable);
  context.subscriptions.push(switchBranchDisposable);
  context.subscriptions.push(pullFromOriginDisposable);
  context.subscriptions.push(mergeFromBaseDisposable);
  context.subscriptions.push(mergePullRequestDisposable);
  context.subscriptions.push(markPullRequestReadyDisposable);
  context.subscriptions.push(signInGithubDisposable);
  context.subscriptions.push(switchGithubAccountDisposable);
  context.subscriptions.push(openGithubAccountsDisposable);
}

function deactivate() {}

function normalizeBranchName(branchName: string) {
  if (branchName.startsWith("refs/heads/")) {
    return branchName.slice("refs/heads/".length);
  }

  if (branchName.startsWith("heads/")) {
    return branchName.slice("heads/".length);
  }

  return branchName;
}

function getBranchName(branchArg: string | { branchName?: string }) {
  if (typeof branchArg === "string") {
    return branchArg;
  }

  return branchArg.branchName ?? "";
}

function isShellSafeGitRef(value: string) {
  return /^[A-Za-z0-9._/-]+$/.test(value);
}

function getGitCommandTemplates(): GitCommandTemplates {
  const configuration = vscode.workspace.getConfiguration("rd-git");
  return {
    switchBranch: configuration.get<string>(
      "gitCommands.switchBranch",
      DEFAULT_GIT_COMMAND_TEMPLATES.switchBranch
    ),
    pullFromOrigin: configuration.get<string>(
      "gitCommands.pullFromOrigin",
      DEFAULT_GIT_COMMAND_TEMPLATES.pullFromOrigin
    ),
    mergeFromBase: configuration.get<string>(
      "gitCommands.mergeFromBase",
      DEFAULT_GIT_COMMAND_TEMPLATES.mergeFromBase
    )
  };
}

function renderGitCommandTemplate(
  template: string,
  values: Record<string, string>,
  fallbackTemplate: string,
  templateKey: keyof GitCommandTemplates,
  logStore: LogStore
) {
  const normalizedTemplate = template.trim();
  if (!normalizedTemplate) {
    logStore.warn("commands", `Setting rd-git.gitCommands.${templateKey} is empty. Using default template.`);
    return renderGitCommandTemplate(fallbackTemplate, values, fallbackTemplate, templateKey, logStore);
  }

  let command = normalizedTemplate;
  for (const [name, value] of Object.entries(values)) {
    command = command.split(`{{${name}}}`).join(value);
  }

  const normalizedCommand = command.trim();
  if (!normalizedCommand) {
    logStore.warn(
      "commands",
      `Setting rd-git.gitCommands.${templateKey} resolved to an empty command. Using default template.`
    );
    return renderGitCommandTemplate(fallbackTemplate, values, fallbackTemplate, templateKey, logStore);
  }

  return normalizedCommand;
}

async function resolveBaseBranch(
  repository: Repository,
  execFileAsync: ExecFileAsync,
  logStore: LogStore
) {
  try {
    const result = await runGit(
      repository,
      execFileAsync,
      ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
      logStore
    );
    const normalized = result.trim();
    if (normalized.startsWith("origin/")) {
      return normalized.slice("origin/".length);
    }
    return normalized;
  } catch {
    logStore.warn("git", "Falling back to base branch 'main' in extension command.");
    return "main";
  }
}

async function runGit(
  repository: Repository,
  execFileAsync: ExecFileAsync,
  args: string[],
  logStore: LogStore
) {
  const commandString = `git ${args.join(" ")}`;
  logStore.info("git", `$ ${commandString}`);
  try {
    const { stdout, stderr } = await execFileAsync("git", args, { cwd: repository.rootUri.fsPath });
    const trimmedStdout = stdout.trim();
    const trimmedStderr = stderr.trim();
    if (trimmedStdout) {
      logStore.info("git", trimmedStdout);
    }
    if (trimmedStderr) {
      logStore.warn("git", trimmedStderr);
      return trimmedStdout || trimmedStderr;
    }
    return trimmedStdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown git command error";
    logStore.error("git", message);
    throw error;
  }
}

async function getGitApi() {
  const gitExtension = vscode.extensions.getExtension<GitExtensionExports>("vscode.git");
  if (!gitExtension) {
    vscode.window.showWarningMessage("Git extension is not available.");
    return undefined;
  }

  if (!gitExtension.isActive) {
    await gitExtension.activate();
  }

  const api = gitExtension.exports.getAPI(1);
  return api as GitAPI;
}

export { activate, deactivate };
