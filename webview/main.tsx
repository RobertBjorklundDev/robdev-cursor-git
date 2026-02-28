import React from "react";
import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  GitMerge,
  LoaderCircle,
  Pencil,
} from "lucide-react";
import { Button } from "./components/Button";
import { Card } from "./components/Card";

interface RecentBranch {
  name: string;
  isCurrent: boolean;
  lastCommitDescription: string;
}

interface PullRequestSummary {
  id: number;
  title: string;
  url: string;
  branchName: string;
  isDraft: boolean;
  state: string;
  mergeable: boolean | undefined;
  mergeableState: string | undefined;
}

interface SetBranchesMessage {
  type: "setBranches";
  branches: RecentBranch[];
  baseBranchName: string;
  isLoading: boolean;
}

interface SetLoadingMessage {
  type: "setLoading";
  isLoading: boolean;
}

interface SetPullRequestsMessage {
  type: "setPullRequests";
  pullRequests: PullRequestSummary[];
}

interface GitHubAuthStatus {
  isProviderAvailable: boolean;
  isAuthenticated: boolean;
}

interface SetAuthStatusMessage {
  type: "setAuthStatus";
  authStatus: GitHubAuthStatus;
}

interface LogEntry {
  timestampIso: string;
  level: "info" | "warn" | "error";
  category: string;
  message: string;
}

interface SetLogsMessage {
  type: "setLogs";
  logs: LogEntry[];
}

interface AppendLogMessage {
  type: "appendLog";
  log: LogEntry;
}

type WebviewMessage =
  | SetBranchesMessage
  | SetLoadingMessage
  | SetPullRequestsMessage
  | SetAuthStatusMessage
  | SetLogsMessage
  | AppendLogMessage;

interface BranchActionMessage {
  type:
    | "switchBranch"
    | "pullFromOrigin"
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

interface WebviewAssets {
  extensionVersion: string;
  extensionBuildCode: string;
}

interface VsCodeApi {
  postMessage(message: BranchActionMessage): void;
  getState<T = unknown>(): T | undefined;
  setState<T>(newState: T): T;
}

interface PullRequestStatusBadge {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

interface WindowWithWebviewData extends Window {
  __BRANCH_SWITCHER_ASSETS__?: WebviewAssets;
  acquireVsCodeApi?: () => VsCodeApi;
}

type ActiveTab = "main" | "logs" | "settings";
type PullRequestFilter = "ready" | "draft";

interface PersistedAppState {
  branches: RecentBranch[];
  pullRequests: PullRequestSummary[];
  logs: LogEntry[];
  isLogAutoScrollEnabled: boolean;
  activeTab: ActiveTab;
  pullRequestFilter: PullRequestFilter;
  baseBranchName: string;
  isLoading: boolean;
  authStatus: GitHubAuthStatus;
}

function isSetBranchesMessage(message: unknown): message is SetBranchesMessage {
  if (!message || typeof message !== "object") {
    return false;
  }
  const candidate = message as Partial<SetBranchesMessage>;
  return candidate.type === "setBranches" && Array.isArray(candidate.branches);
}

function isSetLoadingMessage(message: unknown): message is SetLoadingMessage {
  if (!message || typeof message !== "object") {
    return false;
  }
  const candidate = message as Partial<SetLoadingMessage>;
  return (
    candidate.type === "setLoading" && typeof candidate.isLoading === "boolean"
  );
}

function isSetPullRequestsMessage(
  message: unknown,
): message is SetPullRequestsMessage {
  if (!message || typeof message !== "object") {
    return false;
  }
  const candidate = message as Partial<SetPullRequestsMessage>;
  return (
    candidate.type === "setPullRequests" &&
    Array.isArray(candidate.pullRequests)
  );
}

function isSetAuthStatusMessage(
  message: unknown,
): message is SetAuthStatusMessage {
  if (!message || typeof message !== "object") {
    return false;
  }
  const candidate = message as Partial<SetAuthStatusMessage>;
  return (
    candidate.type === "setAuthStatus" &&
    typeof candidate.authStatus === "object"
  );
}

function isSetLogsMessage(message: unknown): message is SetLogsMessage {
  if (!message || typeof message !== "object") {
    return false;
  }
  const candidate = message as Partial<SetLogsMessage>;
  return candidate.type === "setLogs" && Array.isArray(candidate.logs);
}

function isAppendLogMessage(message: unknown): message is AppendLogMessage {
  if (!message || typeof message !== "object") {
    return false;
  }
  const candidate = message as Partial<AppendLogMessage>;
  return candidate.type === "appendLog" && typeof candidate.log === "object";
}

function getVsCodeApi(windowWithData: WindowWithWebviewData): VsCodeApi {
  if (typeof windowWithData.acquireVsCodeApi === "function") {
    return windowWithData.acquireVsCodeApi();
  }
  return {
    postMessage() {},
    getState() {
      return undefined;
    },
    setState<T>(newState: T) {
      return newState;
    },
  };
}

function restorePersistedAppState(vscode: VsCodeApi) {
  const restoredState = vscode.getState<unknown>();
  if (!restoredState || typeof restoredState !== "object") {
    return {};
  }

  const candidate = restoredState as Partial<PersistedAppState>;
  const nextState: Partial<PersistedAppState> = {};
  if (Array.isArray(candidate.branches)) {
    nextState.branches = candidate.branches;
  }
  if (Array.isArray(candidate.pullRequests)) {
    nextState.pullRequests = candidate.pullRequests;
  }
  if (Array.isArray(candidate.logs)) {
    nextState.logs = candidate.logs;
  }
  if (typeof candidate.isLogAutoScrollEnabled === "boolean") {
    nextState.isLogAutoScrollEnabled = candidate.isLogAutoScrollEnabled;
  }
  if (
    candidate.activeTab === "main" ||
    candidate.activeTab === "logs" ||
    candidate.activeTab === "settings"
  ) {
    nextState.activeTab = candidate.activeTab;
  }
  if (
    candidate.pullRequestFilter === "ready" ||
    candidate.pullRequestFilter === "draft"
  ) {
    nextState.pullRequestFilter = candidate.pullRequestFilter;
  }
  if (typeof candidate.baseBranchName === "string") {
    nextState.baseBranchName = candidate.baseBranchName;
  }
  if (typeof candidate.isLoading === "boolean") {
    nextState.isLoading = candidate.isLoading;
  }
  if (
    candidate.authStatus &&
    typeof candidate.authStatus === "object" &&
    typeof candidate.authStatus.isProviderAvailable === "boolean" &&
    typeof candidate.authStatus.isAuthenticated === "boolean"
  ) {
    nextState.authStatus = candidate.authStatus;
  }
  return nextState;
}

function App() {
  const windowWithData = window as WindowWithWebviewData;
  const vscode = useMemo(() => getVsCodeApi(windowWithData), [windowWithData]);
  const restoredState = useMemo(
    () => restorePersistedAppState(vscode),
    [vscode],
  );
  const extensionVersion =
    windowWithData.__BRANCH_SWITCHER_ASSETS__?.extensionVersion ?? "unknown";
  const extensionBuildCode =
    windowWithData.__BRANCH_SWITCHER_ASSETS__?.extensionBuildCode ?? "dev";
  const [branches, setBranches] = useState<RecentBranch[]>(
    () => restoredState.branches ?? [],
  );
  const [pullRequests, setPullRequests] = useState<PullRequestSummary[]>(
    () => restoredState.pullRequests ?? [],
  );
  const [logs, setLogs] = useState<LogEntry[]>(() => restoredState.logs ?? []);
  const [isLogAutoScrollEnabled, setIsLogAutoScrollEnabled] = useState(
    () => restoredState.isLogAutoScrollEnabled ?? true,
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    () => restoredState.activeTab ?? "main",
  );
  const [pullRequestFilter, setPullRequestFilter] = useState<PullRequestFilter>(
    () => restoredState.pullRequestFilter ?? "ready",
  );
  const [baseBranchName, setBaseBranchName] = useState(
    () => restoredState.baseBranchName ?? "main",
  );
  const [isLoading, setIsLoading] = useState(
    () => restoredState.isLoading ?? true,
  );
  const logsContainerRef = useRef<HTMLDivElement | null>(null);
  const [authStatus, setAuthStatus] = useState<GitHubAuthStatus>({
    isProviderAvailable: restoredState.authStatus?.isProviderAvailable ?? true,
    isAuthenticated: restoredState.authStatus?.isAuthenticated ?? false,
  });

  useEffect(() => {
    const nextState: PersistedAppState = {
      branches,
      pullRequests,
      logs,
      isLogAutoScrollEnabled,
      activeTab,
      pullRequestFilter,
      baseBranchName,
      isLoading,
      authStatus,
    };
    vscode.setState(nextState);
  }, [
    activeTab,
    authStatus,
    baseBranchName,
    branches,
    isLoading,
    isLogAutoScrollEnabled,
    logs,
    pullRequestFilter,
    pullRequests,
    vscode,
  ]);

  useEffect(() => {
    function handleMessage(event: MessageEvent<WebviewMessage>) {
      const message = event.data;
      if (isSetBranchesMessage(message)) {
        setBranches(message.branches);
        setBaseBranchName(message.baseBranchName);
        setIsLoading(message.isLoading);
        return;
      }
      if (isSetLoadingMessage(message)) {
        setIsLoading(message.isLoading);
        return;
      }
      if (isSetPullRequestsMessage(message)) {
        setPullRequests(message.pullRequests);
        return;
      }
      if (isSetAuthStatusMessage(message)) {
        setAuthStatus(message.authStatus);
        return;
      }
      if (isSetLogsMessage(message)) {
        setLogs(message.logs);
        return;
      }
      if (isAppendLogMessage(message)) {
        setLogs((previousLogs) => [...previousLogs, message.log]);
      }
    }

    window.addEventListener("message", handleMessage);
    vscode.postMessage({ type: "ready" });
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [vscode]);

  useEffect(() => {
    if (activeTab !== "logs") {
      return;
    }

    if (!isLogAutoScrollEnabled) {
      return;
    }

    const logsContainer = logsContainerRef.current;
    if (!logsContainer) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [activeTab, isLogAutoScrollEnabled, logs]);

  function onSwitchBranch(branchName: string) {
    vscode.postMessage({ type: "switchBranch", branchName });
  }

  function onMergeBaseIntoBranch(branchName: string) {
    vscode.postMessage({ type: "mergeFromBase", branchName });
  }

  function onPullFromOrigin(branchName: string) {
    vscode.postMessage({ type: "pullFromOrigin", branchName });
  }

  function onOpenPullRequest(url: string) {
    vscode.postMessage({ type: "openPullRequest", pullRequestUrl: url });
  }

  function onMergePullRequest(pullRequestId: number) {
    vscode.postMessage({ type: "mergePullRequest", pullRequestId });
  }

  function onSignInGithub() {
    vscode.postMessage({ type: "signInGithub" });
  }

  function onSwitchGithubAccount() {
    vscode.postMessage({ type: "switchGithubAccount" });
  }

  function onOpenGithubAccounts() {
    vscode.postMessage({ type: "openGithubAccounts" });
  }

  const visiblePullRequests = pullRequests.filter((pullRequest) => {
    if (pullRequestFilter === "draft") {
      return pullRequest.isDraft;
    }
    return !pullRequest.isDraft;
  });

  function getPullRequestStatus(pullRequest: PullRequestSummary) {
    const statusParts: string[] = [];
    if (pullRequest.isDraft) {
      statusParts.push("draft");
    } else {
      statusParts.push(pullRequest.state);
    }
    if (pullRequest.mergeableState) {
      statusParts.push(pullRequest.mergeableState);
    } else if (pullRequest.mergeable === true) {
      statusParts.push("mergeable");
    } else if (pullRequest.mergeable === false) {
      statusParts.push("conflicts");
    }
    return statusParts.join(" • ");
  }

  function getPullRequestBadge(
    pullRequest: PullRequestSummary,
  ): PullRequestStatusBadge {
    if (pullRequest.isDraft) {
      return {
        label: "draft",
        color: "var(--vscode-testing-iconQueued)",
        icon: Pencil,
      };
    }

    if (
      pullRequest.mergeable === false ||
      pullRequest.mergeableState === "dirty"
    ) {
      return {
        label: "conflicts",
        color: "var(--vscode-testing-iconFailed)",
        icon: AlertTriangle,
      };
    }

    if (pullRequest.mergeable === true) {
      return {
        label: "mergeable",
        color: "var(--vscode-testing-iconPassed)",
        icon: GitMerge,
      };
    }

    return {
      label: "open",
      color: "var(--vscode-descriptionForeground)",
      icon: GitMerge,
    };
  }

  function getLogLevelColor(level: LogEntry["level"]) {
    if (level === "error") {
      return "var(--vscode-testing-iconFailed)";
    }
    if (level === "warn") {
      return "var(--vscode-testing-iconQueued)";
    }
    return "var(--vscode-testing-iconPassed)";
  }

  function formatLogTimestamp(timestampIso: string) {
    const timestampDate = new Date(timestampIso);
    if (Number.isNaN(timestampDate.getTime())) {
      return timestampIso;
    }
    return timestampDate.toLocaleTimeString();
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden p-2.5">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
        {activeTab === "main" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto pr-1">
            <Card className="w-full px-3 py-2.5 font-bold" padding="none">
              <div className="flex items-center justify-between gap-2">
                <span>Recent Branches</span>
                {isLoading ? (
                  <LoaderCircle
                    aria-label="Refreshing branches"
                    className="h-3.5 w-3.5 animate-spin text-(--vscode-descriptionForeground)"
                  />
                ) : null}
              </div>
            </Card>

            <div className="flex min-h-14 flex-col gap-2">
              {branches.length === 0 ? (
                <div className="px-1 py-2.5 text-(--vscode-descriptionForeground)">
                  {isLoading
                    ? "Loading recent branches..."
                    : "No recent branches yet."}
                </div>
              ) : (
                branches.map((branch) => (
                  <div className="flex gap-2" key={branch.name}>
                    <Button
                      className="h-8 w-8 p-0"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        onPullFromOrigin(branch.name);
                      }}
                      title={`Pull ${branch.name} from origin`}
                    >
                      <ArrowDownToLine
                        aria-hidden="true"
                        className="mx-auto"
                        size={14}
                      />
                    </Button>
                    <Button
                      className="flex-1 text-left"
                      size="lg"
                      variant={branch.isCurrent ? "primary" : "secondary"}
                      onClick={() => {
                        onSwitchBranch(branch.name);
                      }}
                    >
                      <span className="mb-0.5 block font-semibold">
                        {branch.name}
                      </span>
                      <span className="text-xs text-(--vscode-descriptionForeground)">
                        {branch.lastCommitDescription}
                        {branch.isCurrent ? " • current" : ""}
                      </span>
                    </Button>

                    {branch.name === baseBranchName ? null : (
                      <Button
                        className="h-8 w-8 p-0"
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          onMergeBaseIntoBranch(branch.name);
                        }}
                        title={`Merge ${baseBranchName} into ${branch.name}`}
                      >
                        <GitMerge
                          aria-hidden="true"
                          className="mx-auto"
                          size={14}
                        />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="my-1 h-px w-full bg-(--vscode-panel-border)" />

            <Card className="w-full px-3 py-2.5 font-bold" padding="none">
              Current PRs
            </Card>

            {!authStatus.isProviderAvailable ? (
              <Card
                className="px-3 py-2.5 text-(--vscode-descriptionForeground)"
                padding="none"
              >
                <div className="mb-2">
                  GitHub authentication provider is not available in this host.
                </div>
                <Button variant="primary" onClick={onOpenGithubAccounts}>
                  Open Accounts
                </Button>
              </Card>
            ) : !authStatus.isAuthenticated ? (
              <Card
                className="px-3 py-2.5 text-(--vscode-descriptionForeground)"
                padding="none"
              >
                <div className="mb-2">
                  Sign in to GitHub to load and merge pull requests.
                </div>
                <Button variant="primary" onClick={onSignInGithub}>
                  Sign in with GitHub
                </Button>
              </Card>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant={
                      pullRequestFilter === "ready" ? "primary" : "secondary"
                    }
                    onClick={() => {
                      setPullRequestFilter("ready");
                    }}
                  >
                    Ready
                  </Button>
                  <Button
                    className="flex-1"
                    variant={
                      pullRequestFilter === "draft" ? "primary" : "secondary"
                    }
                    onClick={() => {
                      setPullRequestFilter("draft");
                    }}
                  >
                    Draft
                  </Button>
                </div>

                <div className="flex min-h-14 flex-col gap-2">
                  {isLoading && pullRequests.length === 0 ? (
                    <div className="px-1 py-2.5 text-(--vscode-descriptionForeground)">
                      Loading pull requests...
                    </div>
                  ) : visiblePullRequests.length === 0 ? (
                    <div className="px-1 py-2.5 text-(--vscode-descriptionForeground)">
                      No {pullRequestFilter} pull requests.
                    </div>
                  ) : (
                    visiblePullRequests.map((pullRequest) => (
                      <div className="flex gap-2" key={pullRequest.id}>
                        <Button
                          className="text-left"
                          onClick={() => {
                            onOpenPullRequest(pullRequest.url);
                          }}
                          size="lg"
                          variant="secondary"
                          width="full"
                        >
                          <span className="mb-0.5 block font-semibold">
                            {pullRequest.title}
                          </span>
                          {(() => {
                            const badge = getPullRequestBadge(pullRequest);
                            const StatusIcon = badge.icon;
                            return (
                              <span className="flex items-center gap-2 text-xs">
                                <span className="text-(--vscode-descriptionForeground)">
                                  {pullRequest.branchName}
                                </span>
                                <span
                                  style={{
                                    color:
                                      "var(--vscode-descriptionForeground)",
                                  }}
                                >
                                  •
                                </span>
                                <span
                                  className="flex items-center gap-1.5 font-semibold lowercase"
                                  style={{ color: badge.color }}
                                >
                                  <StatusIcon className="shrink-0" size={14} />
                                  <span>{badge.label}</span>
                                </span>
                                <span className="text-(--vscode-descriptionForeground)">
                                  • {getPullRequestStatus(pullRequest)}
                                </span>
                              </span>
                            );
                          })()}
                        </Button>

                        {pullRequest.isDraft ? null : (
                          <Button
                            className="min-w-[74px]"
                            size="sm"
                            variant="primary"
                            disabled={pullRequest.mergeable !== true}
                            onClick={() => {
                              onMergePullRequest(pullRequest.id);
                            }}
                            title={
                              pullRequest.mergeable === true
                                ? "Merge pull request"
                                : "Pull request is not mergeable"
                            }
                          >
                            Merge
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        ) : activeTab === "logs" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <Card className="mb-2 w-full px-3 py-2.5 font-bold" padding="none">
              Logs
            </Card>
            <Card className="mb-2 flex items-center px-3 py-2" padding="none">
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  checked={isLogAutoScrollEnabled}
                  className="cursor-pointer"
                  onChange={(event) => {
                    setIsLogAutoScrollEnabled(event.target.checked);
                  }}
                  type="checkbox"
                />
                <span>Auto-scroll to newest logs</span>
              </label>
            </Card>
            <Card
              className="min-h-0 flex-1 overflow-auto font-mono text-xs"
              padding="sm"
              ref={logsContainerRef}
            >
              {logs.length === 0 ? (
                <div className="text-(--vscode-descriptionForeground)">
                  No logs yet.
                </div>
              ) : (
                logs.map((logEntry, index) => (
                  <div
                    className="mb-1.5 wrap-break-word"
                    key={`${logEntry.timestampIso}-${index}`}
                  >
                    <span className="text-(--vscode-descriptionForeground)">
                      [{formatLogTimestamp(logEntry.timestampIso)}]
                    </span>
                    <span className="px-1 text-(--vscode-descriptionForeground)">
                      [
                    </span>
                    <span style={{ color: getLogLevelColor(logEntry.level) }}>
                      {logEntry.level.toUpperCase()}
                    </span>
                    <span className="px-1 text-(--vscode-descriptionForeground)">
                      ]
                    </span>
                    <span className="text-(--vscode-descriptionForeground)">
                      [{logEntry.category}]
                    </span>
                    <span className="px-1">{logEntry.message}</span>
                  </div>
                ))
              )}
            </Card>
          </div>
        ) : (
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
                <Button variant="primary" onClick={onSignInGithub}>
                  Sign in with GitHub
                </Button>
                <Button
                  variant="secondary"
                  disabled={!authStatus.isAuthenticated}
                  onClick={onSwitchGithubAccount}
                  title={
                    authStatus.isAuthenticated
                      ? "Switch to another GitHub account"
                      : "Sign in first"
                  }
                >
                  Switch GitHub account
                </Button>
                <Button variant="secondary" onClick={onOpenGithubAccounts}>
                  Open Accounts menu
                </Button>
              </div>
            </Card>
            <Card className="mt-2">
              <div className="mb-1 text-xs text-(--vscode-descriptionForeground)">
                About
              </div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-(--vscode-descriptionForeground)">
                  Version
                </span>
                <span className="font-mono text-xs">{extensionVersion}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-(--vscode-descriptionForeground)">
                  Build code
                </span>
                <span className="font-mono text-xs">{extensionBuildCode}</span>
              </div>
            </Card>
          </div>
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

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing root element for webview.");
}

const root = createRoot(rootElement);
root.render(<App />);
