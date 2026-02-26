import * as vscode from "vscode";
import { RecentBranchesProvider } from "./RecentBranchesProvider";
import type { GitAPI, GitExtensionExports, Repository } from "./types";

async function activate(context: vscode.ExtensionContext) {
  const gitApi = await getGitApi();
  if (!gitApi) {
    return;
  }
  const api = gitApi;

  const provider = new RecentBranchesProvider(context.workspaceState);
  const treeDisposable = vscode.window.registerTreeDataProvider("recentBranchesView", provider);
  context.subscriptions.push(treeDisposable);

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

  context.subscriptions.push(openRepoDisposable);
  context.subscriptions.push(closeRepoDisposable);
  context.subscriptions.push(activeEditorDisposable);
  context.subscriptions.push(switchBranchDisposable);
  context.subscriptions.push(refreshDisposable);
}

function deactivate() {}

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
