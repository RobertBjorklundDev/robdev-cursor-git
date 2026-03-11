import React, { useRef } from "react";
import {
  WebviewAppProvider,
  useWebviewAppContext,
} from "./context/WebviewAppContext";
import { BranchesPanel } from "../../features/branches/webview/BranchesPanel";
import { PullRequestsPanel } from "../../features/pull-requests/webview/PullRequestsPanel";
import {
  TooltipProvider,
} from "../../shared/webview/components";

function AppLayout() {
  const HOVER_REFRESH_COOLDOWN_MS = 10_000;
  const { assets, postRequestRefresh } = useWebviewAppContext();
  const lastHoverRefreshAtRef = useRef(0);
  const shouldRenderGitView = assets.viewMode === "git";

  function handleMouseEnter() {
    const now = Date.now();
    if (now - lastHoverRefreshAtRef.current < HOVER_REFRESH_COOLDOWN_MS) {
      return;
    }
    lastHoverRefreshAtRef.current = now;
    postRequestRefresh();
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden p-2"
      onMouseEnter={handleMouseEnter}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {shouldRenderGitView ? (
          <BranchesPanel />
        ) : (
          <PullRequestsPanel />
        )}
      </div>
    </div>
  );
}

function AppShell() {
  return (
    <WebviewAppProvider>
      <TooltipProvider delayDuration={150}>
        <AppLayout />
      </TooltipProvider>
    </WebviewAppProvider>
  );
}

export { AppShell };
