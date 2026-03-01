import React, { useRef } from "react";
import { WebviewAppProvider, useWebviewAppContext } from "./context/WebviewAppContext";
import { BranchesPanel } from "../../features/branches/webview/BranchesPanel";
import { LogsPanel } from "../../features/logs/webview/LogsPanel";
import { PullRequestsPanel } from "../../features/pull-requests/webview/PullRequestsPanel";
import { SettingsPanel } from "../../features/settings/webview/SettingsPanel";
import { Button } from "../../shared/webview/components";

function AppLayout() {
  const HOVER_REFRESH_COOLDOWN_MS = 10_000;
  const { activeTab, logs, postRequestRefresh, setActiveTab } = useWebviewAppContext();
  const lastHoverRefreshAtRef = useRef(0);

  function handleMouseEnter() {
    const now = Date.now();
    if (now - lastHoverRefreshAtRef.current < HOVER_REFRESH_COOLDOWN_MS) {
      return;
    }
    lastHoverRefreshAtRef.current = now;
    postRequestRefresh();
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden p-2.5" onMouseEnter={handleMouseEnter}>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
        {activeTab === "main" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto pr-1">
            <BranchesPanel />
            <PullRequestsPanel />
          </div>
        ) : activeTab === "logs" ? (
          <LogsPanel />
        ) : (
          <SettingsPanel />
        )}
      </div>

      <div className="mt-2.5 flex shrink-0 gap-2 border-t border-(--vscode-panel-border) pt-2">
        <Button
          className="flex-1"
          variant={activeTab === "main" ? "primary" : "secondary"}
          onClick={() => {
            setActiveTab("main");
          }}
        >
          Main
        </Button>
        <Button
          className="flex-1"
          variant={activeTab === "logs" ? "primary" : "secondary"}
          onClick={() => {
            setActiveTab("logs");
          }}
        >
          Logs ({logs.length})
        </Button>
        <Button
          className="flex-1"
          variant={activeTab === "settings" ? "primary" : "secondary"}
          onClick={() => {
            setActiveTab("settings");
          }}
        >
          Settings
        </Button>
      </div>
    </div>
  );
}

function AppShell() {
  return (
    <WebviewAppProvider>
      <AppLayout />
    </WebviewAppProvider>
  );
}

export { AppShell };
