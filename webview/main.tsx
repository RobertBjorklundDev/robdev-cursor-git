import React from "react";
import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, GitMerge, Pencil } from "lucide-react";

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
  mergeArrowSvg: string;
}

interface VsCodeApi {
  postMessage(message: BranchActionMessage): void;
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
  return candidate.type === "setLoading" && typeof candidate.isLoading === "boolean";
}

function isSetPullRequestsMessage(message: unknown): message is SetPullRequestsMessage {
  if (!message || typeof message !== "object") {
    return false;
  }
  const candidate = message as Partial<SetPullRequestsMessage>;
  return candidate.type === "setPullRequests" && Array.isArray(candidate.pullRequests);
}

function isSetAuthStatusMessage(message: unknown): message is SetAuthStatusMessage {
  if (!message || typeof message !== "object") {
    return false;
  }
  const candidate = message as Partial<SetAuthStatusMessage>;
  return candidate.type === "setAuthStatus" && typeof candidate.authStatus === "object";
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
    postMessage() {}
  };
}

function App() {
  const windowWithData = window as WindowWithWebviewData;
  const vscode = useMemo(() => getVsCodeApi(windowWithData), [windowWithData]);
  const mergeArrowSvg = windowWithData.__BRANCH_SWITCHER_ASSETS__?.mergeArrowSvg;
  const [branches, setBranches] = useState<RecentBranch[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequestSummary[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"main" | "logs" | "settings">("main");
  const [pullRequestFilter, setPullRequestFilter] = useState<"ready" | "draft">("ready");
  const [baseBranchName, setBaseBranchName] = useState("main");
  const [isLoading, setIsLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<GitHubAuthStatus>({
    isProviderAvailable: true,
    isAuthenticated: false
  });

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

  function onSwitchBranch(branchName: string) {
    vscode.postMessage({ type: "switchBranch", branchName });
  }

  function onMergeBaseIntoBranch(branchName: string) {
    vscode.postMessage({ type: "mergeFromBase", branchName });
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

  function getPullRequestBadge(pullRequest: PullRequestSummary): PullRequestStatusBadge {
    if (pullRequest.isDraft) {
      return {
        label: "draft",
        color: "var(--vscode-testing-iconQueued)",
        icon: Pencil
      };
    }

    if (pullRequest.mergeable === false || pullRequest.mergeableState === "dirty") {
      return {
        label: "conflicts",
        color: "var(--vscode-testing-iconFailed)",
        icon: AlertTriangle
      };
    }

    if (pullRequest.mergeable === true) {
      return {
        label: "mergeable",
        color: "var(--vscode-testing-iconPassed)",
        icon: GitMerge
      };
    }

    return {
      label: "open",
      color: "var(--vscode-descriptionForeground)",
      icon: GitMerge
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
    <div className="flex min-h-screen flex-col p-2.5">
      <div className="flex flex-1 flex-col gap-2.5 overflow-auto">
        {activeTab === "main" ? (
          <>
            <div className="w-full rounded-lg border border-(--vscode-panel-border) bg-(--vscode-editor-background) px-3 py-2.5 font-bold">
              Recent Branches
            </div>

            <div className="flex min-h-14 flex-col gap-2">
              {branches.length === 0 ? (
                <div className="px-1 py-2.5 text-(--vscode-descriptionForeground)">
                  {isLoading ? "Loading recent branches..." : "No recent branches yet."}
                </div>
              ) : (
                branches.map((branch) => (
                  <div className="flex gap-2" key={branch.name}>
                    <button
                      className={`flex-1 cursor-pointer rounded-lg border border-(--vscode-button-border,transparent) px-3 py-2.5 text-left ${
                        branch.isCurrent
                          ? "bg-[color-mix(in_srgb,var(--vscode-button-background)_70%,transparent)] text-(--vscode-button-foreground)"
                          : "bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground)"
                      }`}
                      onClick={() => {
                        onSwitchBranch(branch.name);
                      }}
                      type="button"
                    >
                      <span className="mb-0.5 block font-semibold">{branch.name}</span>
                      <span className="text-xs text-(--vscode-descriptionForeground)">
                        {branch.lastCommitDescription}
                        {branch.isCurrent ? " • current" : ""}
                      </span>
                    </button>

                    <button
                      className="min-w-max cursor-pointer rounded-md border border-(--vscode-button-border,transparent) bg-(--vscode-button-background) p-0.5 text-(--vscode-button-foreground)"
                      onClick={() => {
                        onMergeBaseIntoBranch(branch.name);
                      }}
                      title={`Merge ${baseBranchName} into ${branch.name}`}
                      type="button"
                    >
                      <span className="relative block h-7 min-w-[116px]">
                        {mergeArrowSvg ? (
                          <img
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 h-full w-full object-fill"
                            src={mergeArrowSvg}
                          />
                        ) : null}
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-2.5 text-center font-semibold text-(--vscode-button-foreground)">
                          {baseBranchName}
                        </span>
                      </span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="my-1 h-px w-full bg-(--vscode-panel-border)" />

            <div className="w-full rounded-lg border border-(--vscode-panel-border) bg-(--vscode-editor-background) px-3 py-2.5 font-bold">
              Current PRs
            </div>

            {!authStatus.isProviderAvailable ? (
              <div className="rounded-lg border border-(--vscode-panel-border) bg-(--vscode-editor-background) px-3 py-2.5 text-(--vscode-descriptionForeground)">
                <div className="mb-2">GitHub authentication provider is not available in this host.</div>
                <button
                  className="cursor-pointer rounded-md border border-(--vscode-button-border,transparent) bg-(--vscode-button-background) px-2.5 py-1.5 text-(--vscode-button-foreground)"
                  onClick={onOpenGithubAccounts}
                  type="button"
                >
                  Open Accounts
                </button>
              </div>
            ) : !authStatus.isAuthenticated ? (
              <div className="rounded-lg border border-(--vscode-panel-border) bg-(--vscode-editor-background) px-3 py-2.5 text-(--vscode-descriptionForeground)">
                <div className="mb-2">Sign in to GitHub to load and merge pull requests.</div>
                <button
                  className="cursor-pointer rounded-md border border-(--vscode-button-border,transparent) bg-(--vscode-button-background) px-2.5 py-1.5 text-(--vscode-button-foreground)"
                  onClick={onSignInGithub}
                  type="button"
                >
                  Sign in with GitHub
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 cursor-pointer rounded-md border border-(--vscode-button-border,transparent) px-2.5 py-1.5 ${
                      pullRequestFilter === "ready"
                        ? "bg-(--vscode-button-background) text-(--vscode-button-foreground)"
                        : "bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground)"
                    }`}
                    onClick={() => {
                      setPullRequestFilter("ready");
                    }}
                    type="button"
                  >
                    Ready
                  </button>
                  <button
                    className={`flex-1 cursor-pointer rounded-md border border-(--vscode-button-border,transparent) px-2.5 py-1.5 ${
                      pullRequestFilter === "draft"
                        ? "bg-(--vscode-button-background) text-(--vscode-button-foreground)"
                        : "bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground)"
                    }`}
                    onClick={() => {
                      setPullRequestFilter("draft");
                    }}
                    type="button"
                  >
                    Draft
                  </button>
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
                        <button
                          className="w-full cursor-pointer rounded-lg border border-(--vscode-button-border,transparent) bg-(--vscode-button-secondaryBackground) px-3 py-2.5 text-left text-(--vscode-button-secondaryForeground)"
                          onClick={() => {
                            onOpenPullRequest(pullRequest.url);
                          }}
                          type="button"
                        >
                          <span className="mb-0.5 block font-semibold">{pullRequest.title}</span>
                          {(() => {
                            const badge = getPullRequestBadge(pullRequest);
                            const StatusIcon = badge.icon;
                            return (
                              <span className="flex items-center gap-2 text-xs">
                                <span className="text-(--vscode-descriptionForeground)">{pullRequest.branchName}</span>
                                <span style={{ color: "var(--vscode-descriptionForeground)" }}>•</span>
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
                        </button>

                        {pullRequest.isDraft ? null : (
                          <button
                            className="min-w-[74px] cursor-pointer rounded-md border border-(--vscode-button-border,transparent) bg-(--vscode-button-background) px-2 py-1.5 text-(--vscode-button-foreground)"
                            disabled={pullRequest.mergeable !== true}
                            onClick={() => {
                              onMergePullRequest(pullRequest.id);
                            }}
                            title={pullRequest.mergeable === true ? "Merge pull request" : "Pull request is not mergeable"}
                            type="button"
                          >
                            Merge
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </>
        ) : activeTab === "logs" ? (
          <div className="flex flex-1 flex-col">
            <div className="mb-2 w-full rounded-lg border border-(--vscode-panel-border) bg-(--vscode-editor-background) px-3 py-2.5 font-bold">
              Logs
            </div>
            <div className="flex-1 overflow-auto rounded-lg border border-(--vscode-panel-border) bg-(--vscode-editor-background) p-2 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-(--vscode-descriptionForeground)">No logs yet.</div>
              ) : (
                logs.map((logEntry, index) => (
                  <div className="mb-1.5 wrap-break-word" key={`${logEntry.timestampIso}-${index}`}>
                    <span className="text-(--vscode-descriptionForeground)">
                      [{formatLogTimestamp(logEntry.timestampIso)}]
                    </span>
                    <span className="px-1 text-(--vscode-descriptionForeground)">[</span>
                    <span style={{ color: getLogLevelColor(logEntry.level) }}>{logEntry.level.toUpperCase()}</span>
                    <span className="px-1 text-(--vscode-descriptionForeground)">]</span>
                    <span className="text-(--vscode-descriptionForeground)">[{logEntry.category}]</span>
                    <span className="px-1">{logEntry.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="mb-2 w-full rounded-lg border border-(--vscode-panel-border) bg-(--vscode-editor-background) px-3 py-2.5 font-bold">
              Settings
            </div>
            <div className="rounded-lg border border-(--vscode-panel-border) bg-(--vscode-editor-background) p-3">
              <div className="mb-1 text-xs text-(--vscode-descriptionForeground)">GitHub authentication</div>
              <div className="mb-3 font-semibold">
                {authStatus.isProviderAvailable
                  ? authStatus.isAuthenticated
                    ? "Connected"
                    : "Not connected"
                  : "Provider unavailable"}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  className="cursor-pointer rounded-md border border-(--vscode-button-border,transparent) bg-(--vscode-button-background) px-2.5 py-1.5 text-(--vscode-button-foreground)"
                  onClick={onSignInGithub}
                  type="button"
                >
                  Sign in with GitHub
                </button>
                <button
                  className="cursor-pointer rounded-md border border-(--vscode-button-border,transparent) bg-(--vscode-button-secondaryBackground) px-2.5 py-1.5 text-(--vscode-button-secondaryForeground)"
                  disabled={!authStatus.isAuthenticated}
                  onClick={onSwitchGithubAccount}
                  title={authStatus.isAuthenticated ? "Switch to another GitHub account" : "Sign in first"}
                  type="button"
                >
                  Switch GitHub account
                </button>
                <button
                  className="cursor-pointer rounded-md border border-(--vscode-button-border,transparent) bg-(--vscode-button-secondaryBackground) px-2.5 py-1.5 text-(--vscode-button-secondaryForeground)"
                  onClick={onOpenGithubAccounts}
                  type="button"
                >
                  Open Accounts menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex gap-2 border-t border-(--vscode-panel-border) pt-2">
        <button
          className={`flex-1 cursor-pointer rounded-md border border-(--vscode-button-border,transparent) px-2.5 py-1.5 ${
            activeTab === "main"
              ? "bg-(--vscode-button-background) text-(--vscode-button-foreground)"
              : "bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground)"
          }`}
          onClick={() => {
            setActiveTab("main");
          }}
          type="button"
        >
          Main
        </button>
        <button
          className={`flex-1 cursor-pointer rounded-md border border-(--vscode-button-border,transparent) px-2.5 py-1.5 ${
            activeTab === "logs"
              ? "bg-(--vscode-button-background) text-(--vscode-button-foreground)"
              : "bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground)"
          }`}
          onClick={() => {
            setActiveTab("logs");
          }}
          type="button"
        >
          Logs ({logs.length})
        </button>
        <button
          className={`flex-1 cursor-pointer rounded-md border border-(--vscode-button-border,transparent) px-2.5 py-1.5 ${
            activeTab === "settings"
              ? "bg-(--vscode-button-background) text-(--vscode-button-foreground)"
              : "bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground)"
          }`}
          onClick={() => {
            setActiveTab("settings");
          }}
          type="button"
        >
          Settings
        </button>
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
