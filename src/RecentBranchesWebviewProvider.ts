import * as vscode from "vscode";
import type { RecentBranch, RecentBranchesProvider } from "./RecentBranchesProvider";

interface BranchViewMessage {
  type: "switchBranch" | "mergeFromBase" | "refresh";
  branchName?: string;
}

class RecentBranchesWebviewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private readonly provider: RecentBranchesProvider;
  private readonly subscriptions: vscode.Disposable[] = [];

  public constructor(provider: RecentBranchesProvider) {
    this.provider = provider;
    this.subscriptions.push(
      this.provider.onDidChangeTreeData(() => {
        void this.render();
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
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message: BranchViewMessage) => {
      void this.handleMessage(message);
    });
    void this.render();
  }

  private async render() {
    if (!this.view) {
      return;
    }

    const branches = await this.provider.getRecentBranches();
    this.view.webview.html = this.getHtml(this.view.webview, branches);
  }

  private async handleMessage(message: BranchViewMessage) {
    if (message.type === "refresh") {
      await vscode.commands.executeCommand("branchSwitcher.refresh");
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

  private getHtml(webview: vscode.Webview, branches: RecentBranch[]) {
    const nonce = getNonce();
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`
    ].join("; ");

    const rows =
      branches.length === 0
        ? `<div class="empty">No recent branches yet.</div>`
        : branches.map((branch) => this.renderBranchRow(branch)).join("");

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        margin: 0;
        padding: 10px;
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background: transparent;
      }
      .header {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 10px;
      }
      .secondary-button {
        border: 1px solid var(--vscode-button-border, transparent);
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
      }
      .list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .row {
        display: flex;
        gap: 8px;
      }
      .branch-button {
        flex: 1;
        border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 8px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        cursor: pointer;
        text-align: left;
        padding: 10px 12px;
      }
      .branch-button.is-current {
        background: color-mix(in srgb, var(--vscode-button-background) 70%, transparent);
        color: var(--vscode-button-foreground);
      }
      .branch-name {
        font-weight: 600;
        display: block;
        margin-bottom: 2px;
      }
      .branch-meta {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }
      .merge-button {
        white-space: nowrap;
      }
      .empty {
        color: var(--vscode-descriptionForeground);
        padding: 10px 4px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <button class="secondary-button" data-action="refresh">Refresh</button>
    </div>
    <div class="list">${rows}</div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      document.querySelectorAll("button[data-action]").forEach((button) => {
        button.addEventListener("click", () => {
          vscode.postMessage({
            type: button.dataset.action,
            branchName: button.dataset.branch
          });
        });
      });
    </script>
  </body>
</html>`;
  }

  private renderBranchRow(branch: RecentBranch) {
    const safeName = escapeHtml(branch.name);
    const safeDescription = escapeHtml(branch.lastCommitDescription);
    const currentClass = branch.isCurrent ? " is-current" : "";
    return `<div class="row">
  <button class="branch-button${currentClass}" data-action="switchBranch" data-branch="${safeName}">
    <span class="branch-name">${safeName}</span>
    <span class="branch-meta">${safeDescription}${branch.isCurrent ? " • current" : ""}</span>
  </button>
  <button class="secondary-button merge-button" data-action="mergeFromBase" data-branch="${safeName}">Merge</button>
</div>`;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
