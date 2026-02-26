import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RecentBranchesProvider } from "./RecentBranchesProvider";
import { RecentBranchesWebviewProvider } from "./RecentBranchesWebviewProvider";
import type { GitAPI, GitExtensionExports, Repository } from "./types";

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

  const provider = new RecentBranchesProvider(context.workspaceState);
  const webviewProvider = new RecentBranchesWebviewProvider(provider);
  const webviewDisposable = vscode.window.registerWebviewViewProvider(
    "recentBranchesView",
    webviewProvider
  );
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

  const switchBranchDisposable = vscode.commands.registerCommand(
    "branchSwitcher.switchBranch",
    async (branchName: string) => {
      const repository = getCurrentRepository();
      if (!repository) {
        vscode.window.showWarningMessage("No Git repository is available.");
        return;
      }

      try {
        await repository.checkout(branchName);
        await updateCurrentBranchMru(repository);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to switch branch: ${message}`);
      }
    }
  );

  const refreshDisposable = vscode.commands.registerCommand("branchSwitcher.refresh", () => {
    provider.refresh();
  });
  const mergeFromBaseDisposable = vscode.commands.registerCommand(
    "branchSwitcher.mergeFromBase",
    async (branchArg: string | { branchName?: string }) => {
      const repository = getCurrentRepository();
      if (!repository) {
        vscode.window.showWarningMessage("No Git repository is available.");
        return;
      }

      try {
        const targetBranch = normalizeBranchName(getBranchName(branchArg));
        if (!targetBranch) {
          vscode.window.showWarningMessage("Could not determine target branch.");
          return;
        }
        const baseBranch = await resolveBaseBranch(repository, execFileAsync);
        const currentBranch = normalizeBranchName(repository.state.HEAD?.name ?? "");

        if (currentBranch !== targetBranch) {
          await repository.checkout(targetBranch);
          await updateCurrentBranchMru(repository);
        }

        await runGit(repository, execFileAsync, ["merge", baseBranch]);
        await updateCurrentBranchMru(repository);
        vscode.window.showInformationMessage(`Merged '${baseBranch}' into '${targetBranch}'.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Merge failed: ${message}`);
      }
    }
  );

  context.subscriptions.push(openRepoDisposable);
  context.subscriptions.push(closeRepoDisposable);
  context.subscriptions.push(activeEditorDisposable);
  context.subscriptions.push(switchBranchDisposable);
  context.subscriptions.push(refreshDisposable);
  context.subscriptions.push(mergeFromBaseDisposable);
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
  execFileAsync: ExecFileAsync
) {
  try {
    const result = await runGit(repository, execFileAsync, [
      "symbolic-ref",
      "--short",
      "refs/remotes/origin/HEAD"
    ]);
    const normalized = result.trim();
    if (normalized.startsWith("origin/")) {
      return normalized.slice("origin/".length);
    }
    return normalized;
  } catch {
    return "main";
  }
}

async function runGit(
  repository: Repository,
  execFileAsync: ExecFileAsync,
  args: string[]
) {
  const { stdout, stderr } = await execFileAsync("git", args, { cwd: repository.rootUri.fsPath });
  const trimmedStdout = stdout.trim();
  const trimmedStderr = stderr.trim();
  if (trimmedStderr) {
    return trimmedStdout || trimmedStderr;
  }
  return trimmedStdout;
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
