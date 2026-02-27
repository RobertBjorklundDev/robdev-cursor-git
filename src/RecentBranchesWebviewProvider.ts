import * as vscode from "vscode";
import type { LogEntry, LogStore } from "./LogStore";
import type { RecentBranch, RecentBranchesProvider } from "./RecentBranchesProvider";
import type { GitHubAuthStatus, PullRequestSummary, PullRequestsProvider } from "./PullRequestsProvider";

interface BranchViewMessage {
  type:
    | "switchBranch"
    | "mergeFromBase"
    | "ready"
    | "openPullRequest"
    | "mergePullRequest"
    | "signInGithub"
    | "switchGithubAccount"
    | "openGithubAccounts";
  branchName?: string;
  pullRequestId?: number;
  pullRequestUrl?: string;
}

interface WebviewSetBranchesMessage {
  type: "setBranches";
  branches: RecentBranch[];
  baseBranchName: string;
  isLoading: boolean;
}

interface WebviewSetLoadingMessage {
  type: "setLoading";
  isLoading: boolean;
}

interface WebviewSetPullRequestsMessage {
  type: "setPullRequests";
  pullRequests: PullRequestSummary[];
}

interface WebviewSetLogsMessage {
  type: "setLogs";
  logs: LogEntry[];
}

interface WebviewAppendLogMessage {
  type: "appendLog";
  log: LogEntry;
}

interface WebviewSetAuthStatusMessage {
  type: "setAuthStatus";
  authStatus: GitHubAuthStatus;
}

interface WebviewAssets {
  mergeArrowSvg: string;
}

class RecentBranchesWebviewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private readonly provider: RecentBranchesProvider;
  private readonly pullRequestsProvider: PullRequestsProvider;
  private readonly logStore: LogStore;
  private readonly extensionUri: vscode.Uri;
  private readonly subscriptions: vscode.Disposable[] = [];
  private lastBranches: RecentBranch[] = [];
  private lastPullRequests: PullRequestSummary[] = [];
  private lastAuthStatus: GitHubAuthStatus = {
    isProviderAvailable: true,
    isAuthenticated: false
  };
  private lastBaseBranchName = "main";
  private isLoading = false;
  private hasInitializedHtml = false;

  public constructor(
    provider: RecentBranchesProvider,
    pullRequestsProvider: PullRequestsProvider,
    logStore: LogStore,
    extensionUri: vscode.Uri
  ) {
    this.provider = provider;
    this.pullRequestsProvider = pullRequestsProvider;
    this.logStore = logStore;
    this.extensionUri = extensionUri;
    this.subscriptions.push(
      this.provider.onDidChangeTreeData(() => {
        void this.render();
      }),
      this.pullRequestsProvider.onDidChangeData(() => {
        void this.render();
      }),
      this.logStore.onDidAppend((entry) => {
        this.postAppendLog(entry);
      })
    );
  }

  public dispose() {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "media"),
        vscode.Uri.joinPath(this.extensionUri, "resources")
      ]
    };
    webviewView.webview.onDidReceiveMessage((message: BranchViewMessage) => {
      void this.handleMessage(message);
    });
    this.hasInitializedHtml = false;
    void this.render();
  }

  private async render() {
    if (!this.view) {
      return;
    }

    this.isLoading = true;
    if (!this.hasInitializedHtml) {
      this.view.webview.html = this.getHtml(this.view.webview);
      this.hasInitializedHtml = true;
      this.postBranchesUpdate(this.lastBranches, this.lastBaseBranchName, this.isLoading);
      this.postPullRequestsUpdate(this.lastPullRequests);
      this.postAuthStatus(this.lastAuthStatus);
      this.postLogs(this.logStore.getEntries());
    } else {
      this.postLoading(this.isLoading);
    }

    try {
      const [branches, baseBranchName, pullRequests, authStatus] = await Promise.all([
        this.provider.getRecentBranches(),
        this.provider.getBaseBranchName(),
        this.pullRequestsProvider.getPullRequests(),
        this.pullRequestsProvider.getAuthStatus()
      ]);
      this.lastBranches = branches;
      this.lastBaseBranchName = baseBranchName;
      this.lastPullRequests = pullRequests;
      this.lastAuthStatus = authStatus;
      this.isLoading = false;
      this.postBranchesUpdate(branches, baseBranchName, this.isLoading);
      this.postPullRequestsUpdate(pullRequests);
      this.postAuthStatus(authStatus);
    } catch {
      this.isLoading = false;
      this.postBranchesUpdate(this.lastBranches, this.lastBaseBranchName, this.isLoading);
      this.postPullRequestsUpdate(this.lastPullRequests);
      this.postAuthStatus(this.lastAuthStatus);
    }
  }

  private postLoading(isLoading: boolean) {
    if (!this.view) {
      return;
    }
    const message: WebviewSetLoadingMessage = {
      type: "setLoading",
      isLoading
    };
    this.view.webview.postMessage(message);
  }

  private postBranchesUpdate(branches: RecentBranch[], baseBranchName: string, isLoading: boolean) {
    if (!this.view) {
      return;
    }
    const message: WebviewSetBranchesMessage = {
      type: "setBranches",
      branches,
      baseBranchName,
      isLoading
    };
    this.view.webview.postMessage(message);
  }

  private postPullRequestsUpdate(pullRequests: PullRequestSummary[]) {
    if (!this.view) {
      return;
    }
    const message: WebviewSetPullRequestsMessage = {
      type: "setPullRequests",
      pullRequests
    };
    this.view.webview.postMessage(message);
  }

  private postLogs(logs: LogEntry[]) {
    if (!this.view) {
      return;
    }
    const message: WebviewSetLogsMessage = {
      type: "setLogs",
      logs
    };
    this.view.webview.postMessage(message);
  }

  private postAppendLog(log: LogEntry) {
    if (!this.view) {
      return;
    }
    const message: WebviewAppendLogMessage = {
      type: "appendLog",
      log
    };
    this.view.webview.postMessage(message);
  }

  private postAuthStatus(authStatus: GitHubAuthStatus) {
    if (!this.view) {
      return;
    }
    const message: WebviewSetAuthStatusMessage = {
      type: "setAuthStatus",
      authStatus
    };
    this.view.webview.postMessage(message);
  }

  private async handleMessage(message: BranchViewMessage) {
    if (message.type === "ready") {
      this.postBranchesUpdate(this.lastBranches, this.lastBaseBranchName, this.isLoading);
      this.postPullRequestsUpdate(this.lastPullRequests);
      this.postAuthStatus(this.lastAuthStatus);
      this.postLogs(this.logStore.getEntries());
      return;
    }

    if (message.type === "signInGithub") {
      await vscode.commands.executeCommand("branchSwitcher.signInGithub");
      return;
    }

    if (message.type === "switchGithubAccount") {
      await vscode.commands.executeCommand("branchSwitcher.switchGithubAccount");
      return;
    }

    if (message.type === "openGithubAccounts") {
      await vscode.commands.executeCommand("branchSwitcher.openGithubAccounts");
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
      await vscode.commands.executeCommand("branchSwitcher.mergePullRequest", message.pullRequestId);
      return;
    }

    if (!message.branchName) {
      return;
    }

    if (message.type === "switchBranch") {
      await vscode.commands.executeCommand("branchSwitcher.switchBranch", message.branchName);
      return;
    }

    if (message.type === "mergeFromBase") {
      await vscode.commands.executeCommand("branchSwitcher.mergeFromBase", message.branchName);
    }
  }

  private getHtml(webview: vscode.Webview) {
    const nonce = getNonce();
    const stylesheetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "webview.css")
    );
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview.js"));
    const mergeArrowUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "resources", "merge-base-arrow.svg")
    );
    const assets: WebviewAssets = {
      mergeArrowSvg: mergeArrowUri.toString()
    };
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} data:`,
      `script-src ${webview.cspSource} 'nonce-${nonce}'`
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
      window.__BRANCH_SWITCHER_ASSETS__ = ${JSON.stringify(assets)};
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function getNonce() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 32; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

export { RecentBranchesWebviewProvider };
