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
  assigneeLogins: string[];
  isAssignedToViewer: boolean;
  updatedAtIso: string;
  isDraft: boolean;
  state: string;
  mergeable: boolean | undefined;
  mergeableState: string | undefined;
}

interface GitHubAuthStatus {
  isProviderAvailable: boolean;
  isAuthenticated: boolean;
}

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestampIso: string;
  level: LogLevel;
  category: string;
  message: string;
}

type ActiveTab = "main" | "logs" | "settings";
type PullRequestFilter = "ready" | "draft";

interface BranchActionMessage {
  type:
    | "switchBranch"
    | "pullFromOrigin"
    | "mergeFromBase"
    | "requestRefresh"
    | "ready"
    | "openPullRequest"
    | "mergePullRequest"
    | "markPullRequestReady"
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

type ExtensionToWebviewMessage =
  | WebviewSetBranchesMessage
  | WebviewSetLoadingMessage
  | WebviewSetPullRequestsMessage
  | WebviewSetLogsMessage
  | WebviewAppendLogMessage
  | WebviewSetAuthStatusMessage;

interface WebviewAssets {
  extensionVersion: string;
  extensionBuildCode: string;
}

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

interface PersistedWebviewState {
  branches: RecentBranch[];
  pullRequests: PullRequestSummary[];
  authStatus: GitHubAuthStatus;
  baseBranchName: string;
}

export type {
  ActiveTab,
  BranchActionMessage,
  ExtensionToWebviewMessage,
  GitHubAuthStatus,
  LogEntry,
  LogLevel,
  PersistedAppState,
  PersistedWebviewState,
  PullRequestFilter,
  PullRequestSummary,
  RecentBranch,
  WebviewAppendLogMessage,
  WebviewAssets,
  WebviewSetAuthStatusMessage,
  WebviewSetBranchesMessage,
  WebviewSetLoadingMessage,
  WebviewSetLogsMessage,
  WebviewSetPullRequestsMessage
};
