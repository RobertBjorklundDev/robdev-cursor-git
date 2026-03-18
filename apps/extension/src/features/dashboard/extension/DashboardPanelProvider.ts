import * as vscode from "vscode";
import type { PullRequestsProvider } from "../../pull-requests/extension";

class DashboardPanelProvider {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;
  private readonly pullRequestsProvider: PullRequestsProvider;

  constructor(extensionUri: vscode.Uri, pullRequestsProvider: PullRequestsProvider) {
    this.extensionUri = extensionUri;
    this.pullRequestsProvider = pullRequestsProvider;
  }

  async openDashboard() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "rd-git.dashboard",
      "RDgit Dashboard",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "dist", "dashboard"),
        ],
      },
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.html = this.getHtml(this.panel.webview);

    const session = await this.pullRequestsProvider.getGitHubSessionForDashboard();
    if (session) {
      this.panel.webview.postMessage({
        type: "setAuthToken",
        accessToken: session.accessToken,
        login: session.account?.label,
      });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();

    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `img-src ${webview.cspSource} data: https:`,
      `script-src 'nonce-${nonce}'`,
      `connect-src https://api.github.com https://github.com`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RDgit Dashboard</title>
    <style nonce="${nonce}">
      body {
        margin: 0;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-font-family);
      }
      .placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        color: var(--vscode-descriptionForeground);
      }
    </style>
  </head>
  <body>
    <div class="placeholder">
      <p>RDgit Dashboard will load from the standalone web app build.<br>
      Run <code>pnpm run dev</code> in <code>apps/web/</code> to develop the dashboard, or build it and embed the output here.</p>
    </div>
  </body>
</html>`;
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 32; i++) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

export { DashboardPanelProvider };
