import * as vscode from "vscode";
import type { LogStore } from "../../logs/extension";
import type { RecentBranchesProvider } from "../../branches/extension";
import type { PullRequestsProvider } from "../../pull-requests/extension";
import type {
  BranchActionMessage,
  GitOperationState,
  GitHubAuthStatus,
  LogEntry,
  PersistedWebviewState,
  PullRequestSummary,
  RecentBranch,
  WebviewAssets,
  WebviewAppendLogMessage,
  WebviewSetAuthStatusMessage,
  WebviewSetBranchesMessage,
  WebviewSetGitOperationStateMessage,
  WebviewSetLoadingMessage,
  WebviewSetLogsMessage,
  WebviewSetPullRequestsMessage,
} from "../../../shared/webview/contracts";

const PERSISTED_WEBVIEW_STATE_KEY = "rd-git.webviewState";
const VISIBLE_REFRESH_INTERVAL_MS = 60_000;
const VISIBILITY_REFRESH_COOLDOWN_MS = 10_000;

class RecentBranchesWebviewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private readonly provider: RecentBranchesProvider;
  private readonly pullRequestsProvider: PullRequestsProvider;
  private readonly logStore: LogStore;
  private readonly extensionUri: vscode.Uri;
  private readonly workspaceState: vscode.Memento;
  private readonly extensionVersion: string;
  private readonly extensionBuildCode: string;
  private readonly subscriptions: vscode.Disposable[] = [];
  private lastBranches: RecentBranch[] = [];
  private lastPullRequests: PullRequestSummary[] = [];
  private lastAuthStatus: GitHubAuthStatus = {
    isProviderAvailable: true,
    isAuthenticated: false,
  };
  private lastBaseBranchName = "main";
  private lastGitOperationState: GitOperationState = {
    isInProgress: false,
    action: undefined,
    terminalName: undefined,
    notice: undefined
  };
  private isLoading = false;
  private hasInitializedHtml = false;
  private visibleRefreshTimer: ReturnType<typeof setInterval> | undefined;
  private lastVisibilityRefreshAt = 0;

  public constructor(
    provider: RecentBranchesProvider,
    pullRequestsProvider: PullRequestsProvider,
    logStore: LogStore,
    extensionUri: vscode.Uri,
    workspaceState: vscode.Memento,
    extensionVersion: string,
    extensionBuildCode: string,
  ) {
    this.provider = provider;
    this.pullRequestsProvider = pullRequestsProvider;
    this.logStore = logStore;
    this.extensionUri = extensionUri;
    this.workspaceState = workspaceState;
    this.extensionVersion = extensionVersion;
    this.extensionBuildCode = extensionBuildCode;
    this.restorePersistedState();
    this.subscriptions.push(
      this.provider.onDidChangeTreeData(() => {
        void this.render();
      }),
      this.pullRequestsProvider.onDidChangeData(() => {
        void this.render();
      }),
      this.logStore.onDidAppend((entry) => {
        this.postAppendLog(entry);
      }),
    );
  }

  public dispose() {
    this.stopVisibleRefreshTimer();
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this.stopVisibleRefreshTimer();
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "dist", "media"),
        vscode.Uri.joinPath(this.extensionUri, "resources"),
      ],
    };
    webviewView.webview.onDidReceiveMessage((message: BranchActionMessage) => {
      void this.handleMessage(message);
    });
    this.subscriptions.push(
      webviewView.onDidChangeVisibility(() => {
        this.handleVisibilityChanged();
      }),
    );
    this.hasInitializedHtml = false;
    this.handleVisibilityChanged();
  }

  public setGitOperationState(gitOperationState: GitOperationState) {
    this.lastGitOperationState = gitOperationState;
    this.postGitOperationState(gitOperationState);
  }

  private handleVisibilityChanged() {
    if (!this.view) {
      this.stopVisibleRefreshTimer();
      return;
    }

    if (!this.view.visible) {
      this.stopVisibleRefreshTimer();
      return;
    }

    this.startVisibleRefreshTimer();

    const now = Date.now();
    if (now - this.lastVisibilityRefreshAt >= VISIBILITY_REFRESH_COOLDOWN_MS) {
      this.lastVisibilityRefreshAt = now;
      void this.render();
    }
  }

  private startVisibleRefreshTimer() {
    if (this.visibleRefreshTimer) {
      return;
    }
    this.visibleRefreshTimer = setInterval(() => {
      if (!this.view?.visible) {
        return;
      }
      void this.render();
    }, VISIBLE_REFRESH_INTERVAL_MS);
  }

  private stopVisibleRefreshTimer() {
    if (!this.visibleRefreshTimer) {
      return;
    }
    clearInterval(this.visibleRefreshTimer);
    this.visibleRefreshTimer = undefined;
  }

  private async render() {
    if (!this.view) {
      return;
    }

    this.isLoading = true;
    if (!this.hasInitializedHtml) {
      this.view.webview.html = this.getHtml(this.view.webview);
      this.hasInitializedHtml = true;
      this.postBranchesUpdate(
        this.lastBranches,
        this.lastBaseBranchName,
        this.isLoading,
      );
      this.postPullRequestsUpdate(this.lastPullRequests);
      this.postAuthStatus(this.lastAuthStatus);
      this.postLogs(this.logStore.getEntries());
      this.postGitOperationState(this.lastGitOperationState);
    } else {
      this.postLoading(this.isLoading);
    }

    try {
      const [branches, baseBranchName, pullRequests, authStatus] =
        await Promise.all([
          this.provider.getRecentBranches(),
          this.provider.getBaseBranchName(),
          this.pullRequestsProvider.getPullRequests(),
          this.pullRequestsProvider.getAuthStatus(),
        ]);
      this.lastBranches = branches;
      this.lastBaseBranchName = baseBranchName;
      this.lastPullRequests = pullRequests;
      this.lastAuthStatus = authStatus;
      this.isLoading = false;
      await this.persistCurrentState();
      this.postBranchesUpdate(branches, baseBranchName, this.isLoading);
      this.postPullRequestsUpdate(pullRequests);
      this.postAuthStatus(authStatus);
      this.postGitOperationState(this.lastGitOperationState);
    } catch {
      this.isLoading = false;
      this.postBranchesUpdate(
        this.lastBranches,
        this.lastBaseBranchName,
        this.isLoading,
      );
      this.postPullRequestsUpdate(this.lastPullRequests);
      this.postAuthStatus(this.lastAuthStatus);
      this.postGitOperationState(this.lastGitOperationState);
    }
  }

  private postLoading(isLoading: boolean) {
    if (!this.view) {
      return;
    }
    const message: WebviewSetLoadingMessage = {
      type: "setLoading",
      isLoading,
    };
    this.view.webview.postMessage(message);
  }

  private postBranchesUpdate(
    branches: RecentBranch[],
    baseBranchName: string,
    isLoading: boolean,
  ) {
    if (!this.view) {
      return;
    }
    const message: WebviewSetBranchesMessage = {
      type: "setBranches",
      branches,
      baseBranchName,
      isLoading,
    };
    this.view.webview.postMessage(message);
  }

  private postPullRequestsUpdate(pullRequests: PullRequestSummary[]) {
    if (!this.view) {
      return;
    }
    const message: WebviewSetPullRequestsMessage = {
      type: "setPullRequests",
      pullRequests,
    };
    this.view.webview.postMessage(message);
  }

  private postLogs(logs: LogEntry[]) {
    if (!this.view) {
      return;
    }
    const message: WebviewSetLogsMessage = {
      type: "setLogs",
      logs,
    };
    this.view.webview.postMessage(message);
  }

  private postAppendLog(log: LogEntry) {
    if (!this.view) {
      return;
    }
    const message: WebviewAppendLogMessage = {
      type: "appendLog",
      log,
    };
    this.view.webview.postMessage(message);
  }

  private postAuthStatus(authStatus: GitHubAuthStatus) {
    if (!this.view) {
      return;
    }
    const message: WebviewSetAuthStatusMessage = {
      type: "setAuthStatus",
      authStatus,
    };
    this.view.webview.postMessage(message);
  }

  private postGitOperationState(gitOperationState: GitOperationState) {
    if (!this.view) {
      return;
    }
    const message: WebviewSetGitOperationStateMessage = {
      type: "setGitOperationState",
      gitOperationState
    };
    this.view.webview.postMessage(message);
  }

  private async handleMessage(message: BranchActionMessage) {
    if (message.type === "requestRefresh") {
      void this.render();
      return;
    }

    if (message.type === "ready") {
      this.postBranchesUpdate(
        this.lastBranches,
        this.lastBaseBranchName,
        this.isLoading,
      );
      this.postPullRequestsUpdate(this.lastPullRequests);
      this.postAuthStatus(this.lastAuthStatus);
      this.postLogs(this.logStore.getEntries());
      this.postGitOperationState(this.lastGitOperationState);
      return;
    }

    if (message.type === "clearLogs") {
      this.logStore.clear();
      this.postLogs(this.logStore.getEntries());
      return;
    }

    if (message.type === "setLogLevelFilters") {
      if (!isValidLogLevels(message.logLevels)) {
        return;
      }
      return;
    }

    if (message.type === "signInGithub") {
      await vscode.commands.executeCommand("rd-git.signInGithub");
      return;
    }

    if (message.type === "switchGithubAccount") {
      await vscode.commands.executeCommand(
        "rd-git.switchGithubAccount",
      );
      return;
    }

    if (message.type === "openGithubAccounts") {
      await vscode.commands.executeCommand("rd-git.openGithubAccounts");
      return;
    }

    if (message.type === "openPullRequest") {
      if (!message.pullRequestUrl) {
        return;
      }
      const url = vscode.Uri.parse(message.pullRequestUrl);
      await vscode.env.openExternal(url);
      return;
    }

    if (message.type === "mergePullRequest") {
      if (typeof message.pullRequestId !== "number") {
        return;
      }
      await vscode.commands.executeCommand(
        "rd-git.mergePullRequest",
        message.pullRequestId,
      );
      return;
    }

    if (message.type === "markPullRequestReady") {
      if (typeof message.pullRequestId !== "number") {
        return;
      }
      await vscode.commands.executeCommand(
        "rd-git.markPullRequestReady",
        message.pullRequestId,
      );
      return;
    }

    if (!message.branchName) {
      return;
    }

    if (message.type === "switchBranch") {
      await vscode.commands.executeCommand(
        "rd-git.switchBranch",
        message.branchName,
      );
      return;
    }

    if (message.type === "mergeFromBase") {
      await vscode.commands.executeCommand(
        "rd-git.mergeFromBase",
        message.branchName,
      );
      return;
    }

    if (message.type === "pullFromOrigin") {
      await vscode.commands.executeCommand(
        "rd-git.pullFromOrigin",
        message.branchName,
      );
    }
  }

  private getHtml(webview: vscode.Webview) {
    const nonce = getNonce();
    const stylesheetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "media", "webview.css"),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "media", "webview.js"),
    );
    const assets: WebviewAssets = {
      extensionVersion: this.extensionVersion,
      extensionBuildCode: this.extensionBuildCode,
    };
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} data:`,
      `script-src ${webview.cspSource} 'nonce-${nonce}'`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${stylesheetUri}">
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">
      window.__RD_GIT_ASSETS__ = ${JSON.stringify(assets)};
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }

  private restorePersistedState() {
    const persistedState = this.workspaceState.get<unknown>(
      PERSISTED_WEBVIEW_STATE_KEY,
    );
    if (!isPersistedWebviewState(persistedState)) {
      return;
    }
    this.lastBranches = persistedState.branches;
    this.lastPullRequests = persistedState.pullRequests;
    this.lastAuthStatus = persistedState.authStatus;
    this.lastBaseBranchName = persistedState.baseBranchName;
  }

  private async persistCurrentState() {
    const state: PersistedWebviewState = {
      branches: this.lastBranches,
      pullRequests: this.lastPullRequests,
      authStatus: this.lastAuthStatus,
      baseBranchName: this.lastBaseBranchName,
    };
    await this.workspaceState.update(PERSISTED_WEBVIEW_STATE_KEY, state);
  }
}

function isPersistedWebviewState(
  value: unknown,
): value is PersistedWebviewState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<PersistedWebviewState>;
  return (
    Array.isArray(candidate.branches) &&
    Array.isArray(candidate.pullRequests) &&
    typeof candidate.baseBranchName === "string" &&
    !!candidate.authStatus &&
    typeof candidate.authStatus === "object" &&
    typeof candidate.authStatus.isProviderAvailable === "boolean" &&
    typeof candidate.authStatus.isAuthenticated === "boolean"
  );
}

function getNonce() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 32; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

function isValidLogLevels(value: unknown): value is Array<"info" | "warn" | "error"> {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((level) => level === "info" || level === "warn" || level === "error");
}

export { RecentBranchesWebviewProvider };
