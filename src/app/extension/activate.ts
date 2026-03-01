import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LogStore } from "../../features/logs/extension";
import { RecentBranchesProvider } from "../../features/branches/extension";
import { RecentBranchesWebviewProvider } from "../../features/webview/extension";
import { PullRequestsProvider } from "../../features/pull-requests/extension";
import type { GitAPI, GitExtensionExports, Repository } from "../../shared/extension";

interface ExtensionPackageJson {
  version?: unknown;
  robdevBuildCode?: unknown;
}

type ExecFileAsync = (
  file: string,
  args: string[],
  options: { cwd: string }
) => Promise<{ stdout: string; stderr: string }>;

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
  const webviewDisposable = vscode.window.registerWebviewViewProvider("recentBranchesView", webviewProvider, {
    webviewOptions: {
      retainContextWhenHidden: true
    }
  });
  context.subscriptions.push(webviewDisposable);
  context.subscriptions.push(webviewProvider);

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
    "branchSwitcher.switchBranch",
    async (branchName: string) => {
      const repository = getCurrentRepository();
      if (!repository) {
        logStore.warn("commands", "Switch branch requested with no available repository.");
        return;
      }

      try {
        logStore.info("commands", `Switching branch to '${branchName}'.`);
        await repository.checkout(branchName);
        await updateCurrentBranchMru(repository);
        logStore.info("commands", `Switched branch to '${branchName}'.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logStore.error("commands", `Failed to switch branch: ${message}`);
      }
    }
  );

  const pullFromOriginDisposable = vscode.commands.registerCommand(
    "branchSwitcher.pullFromOrigin",
    async (branchArg: string | { branchName?: string }) => {
      const repository = getCurrentRepository();
      if (!repository) {
        logStore.warn("commands", "Pull from origin requested with no available repository.");
        return;
      }

      try {
        const targetBranch = normalizeBranchName(getBranchName(branchArg));
        if (!targetBranch) {
          logStore.warn("commands", "Could not determine target branch for pull from origin.");
          return;
        }
        const currentBranch = normalizeBranchName(repository.state.HEAD?.name ?? "");

        if (currentBranch !== targetBranch) {
          logStore.info("commands", `Checking out '${targetBranch}' before pull.`);
          await repository.checkout(targetBranch);
          await updateCurrentBranchMru(repository);
        }

        await runGit(repository, execFileAsync, ["pull", "origin", targetBranch], logStore);
        await updateCurrentBranchMru(repository);
        logStore.info("commands", `Pulled latest changes from origin/${targetBranch}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logStore.error("commands", `Pull from origin failed: ${message}`);
      }
    }
  );

  const mergeFromBaseDisposable = vscode.commands.registerCommand(
    "branchSwitcher.mergeFromBase",
    async (branchArg: string | { branchName?: string }) => {
      const repository = getCurrentRepository();
      if (!repository) {
        logStore.warn("commands", "Merge from base requested with no available repository.");
        return;
      }

      try {
        const targetBranch = normalizeBranchName(getBranchName(branchArg));
        if (!targetBranch) {
          logStore.warn("commands", "Could not determine target branch for merge from base.");
          return;
        }
        const baseBranch = await resolveBaseBranch(repository, execFileAsync, logStore);
        const currentBranch = normalizeBranchName(repository.state.HEAD?.name ?? "");

        if (currentBranch !== targetBranch) {
          logStore.info("commands", `Checking out '${targetBranch}' before merge.`);
          await repository.checkout(targetBranch);
          await updateCurrentBranchMru(repository);
        }

        await runGit(repository, execFileAsync, ["merge", baseBranch], logStore);
        await updateCurrentBranchMru(repository);
        logStore.info("commands", `Merged '${baseBranch}' into '${targetBranch}'.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logStore.error("commands", `Merge failed: ${message}`);
      }
    }
  );

  const mergePullRequestDisposable = vscode.commands.registerCommand(
    "branchSwitcher.mergePullRequest",
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
    "branchSwitcher.markPullRequestReady",
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

  const signInGithubDisposable = vscode.commands.registerCommand("branchSwitcher.signInGithub", async () => {
    const didSignIn = await pullRequestsProvider.signIn();
    if (!didSignIn) {
      logStore.warn("auth", "GitHub sign-in was canceled or unavailable.");
    }
    pullRequestsProvider.refresh();
  });

  const switchGithubAccountDisposable = vscode.commands.registerCommand(
    "branchSwitcher.switchGithubAccount",
    async () => {
      const didSwitch = await pullRequestsProvider.switchAccount();
      if (!didSwitch) {
        logStore.warn("auth", "GitHub account switch was canceled or unavailable.");
      }
      pullRequestsProvider.refresh();
    }
  );

  const openGithubAccountsDisposable = vscode.commands.registerCommand(
    "branchSwitcher.openGithubAccounts",
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
