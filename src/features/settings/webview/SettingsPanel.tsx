import React from "react";
import { useWebviewAppContext } from "../../../app/webview/context/WebviewAppContext";
import { Button, Card } from "../../../shared/webview/components";

function SettingsPanel() {
  const {
    assets,
    authStatus,
    postOpenGithubAccounts,
    postSignInGithub,
    postSwitchGithubAccount
  } = useWebviewAppContext();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto pr-1">
      <Card className="mb-2 w-full px-3 py-2.5 font-bold" padding="none">
        Settings
      </Card>
      <Card>
        <div className="mb-1 text-xs text-(--vscode-descriptionForeground)">
          GitHub authentication
        </div>
        <div className="mb-3 font-semibold">
          {authStatus.isProviderAvailable
            ? authStatus.isAuthenticated
              ? "Connected"
              : "Not connected"
            : "Provider unavailable"}
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={postSignInGithub}>
            Sign in with GitHub
          </Button>
          <Button
            variant="secondary"
            disabled={!authStatus.isAuthenticated}
            onClick={postSwitchGithubAccount}
            title={authStatus.isAuthenticated ? "Switch to another GitHub account" : "Sign in first"}
          >
            Switch GitHub account
          </Button>
          <Button variant="secondary" onClick={postOpenGithubAccounts}>
            Open Accounts menu
          </Button>
        </div>
      </Card>
      <Card className="mt-2">
        <div className="mb-1 text-xs text-(--vscode-descriptionForeground)">About</div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-(--vscode-descriptionForeground)">Version</span>
          <span className="font-mono text-xs">{assets.extensionVersion}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-(--vscode-descriptionForeground)">Build code</span>
          <span className="font-mono text-xs">{assets.extensionBuildCode}</span>
        </div>
      </Card>
    </div>
  );
}

export { SettingsPanel };
