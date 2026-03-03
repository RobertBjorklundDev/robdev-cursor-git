import React, { useRef, useState } from "react";
import {
  WebviewAppProvider,
  useWebviewAppContext,
} from "./context/WebviewAppContext";
import { BranchesPanel } from "../../features/branches/webview/BranchesPanel";
import { LogsPanel } from "../../features/logs/webview/LogsPanel";
import { PullRequestsPanel } from "../../features/pull-requests/webview/PullRequestsPanel";
import { SettingsPanel } from "../../features/settings/webview/SettingsPanel";
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TooltipProvider,
} from "../../shared/webview/components";

function AppLayout() {
  const HOVER_REFRESH_COOLDOWN_MS = 10_000;
  const { activeTab, logs, postRequestRefresh, setActiveTab } =
    useWebviewAppContext();
  const lastHoverRefreshAtRef = useRef(0);
  const [mainSubTab, setMainSubTab] = useState<"branches" | "pullRequests">(
    "branches",
  );

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
        {activeTab === "main" ? (
          <Tabs
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
            value={mainSubTab}
            onValueChange={(nextValue) => {
              if (nextValue === "branches" || nextValue === "pullRequests") {
                setMainSubTab(nextValue);
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="branches">Branches</TabsTrigger>
              <TabsTrigger value="pullRequests">PRs</TabsTrigger>
            </TabsList>
            <TabsContent
              className="min-h-0 flex-1 overflow-auto pr-0.5"
              value="branches"
            >
              <BranchesPanel />
            </TabsContent>
            <TabsContent
              className="min-h-0 flex-1 overflow-auto pr-0.5"
              value="pullRequests"
            >
              <PullRequestsPanel />
            </TabsContent>
          </Tabs>
        ) : activeTab === "logs" ? (
          <LogsPanel />
        ) : (
          <SettingsPanel />
        )}
      </div>

      <div className="mt-2 flex shrink-0 gap-1.5 border-t border-border pt-1.5">
        <Button
          className="flex-1"
          size="sm"
          variant={activeTab === "main" ? "primary" : "secondary"}
          onClick={() => {
            setActiveTab("main");
          }}
        >
          Main
        </Button>
        <Button
          className="flex-1"
          size="sm"
          variant={activeTab === "logs" ? "primary" : "secondary"}
          onClick={() => {
            setActiveTab("logs");
          }}
        >
          Logs ({logs.length})
        </Button>
        <Button
          className="flex-1"
          size="sm"
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
      <TooltipProvider delayDuration={150}>
        <AppLayout />
      </TooltipProvider>
    </WebviewAppProvider>
  );
}

export { AppShell };
