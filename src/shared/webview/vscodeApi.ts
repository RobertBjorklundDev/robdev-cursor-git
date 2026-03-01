import type {
  BranchActionMessage,
  ExtensionToWebviewMessage,
  PersistedAppState,
  WebviewAssets
} from "./contracts";

interface VsCodeApi {
  postMessage(message: BranchActionMessage): void;
  getState<T = unknown>(): T | undefined;
  setState<T>(newState: T): T;
}

interface WindowWithWebviewData extends Window {
  __BRANCH_SWITCHER_ASSETS__?: WebviewAssets;
  acquireVsCodeApi?: () => VsCodeApi;
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
    }
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
  if (candidate.pullRequestFilter === "ready" || candidate.pullRequestFilter === "draft") {
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

function isExtensionToWebviewMessage(message: unknown): message is ExtensionToWebviewMessage {
  if (!message || typeof message !== "object") {
    return false;
  }
  const typeValue = (message as { type?: unknown }).type;
  return (
    typeValue === "setBranches" ||
    typeValue === "setLoading" ||
    typeValue === "setPullRequests" ||
    typeValue === "setAuthStatus" ||
    typeValue === "setLogs" ||
    typeValue === "appendLog"
  );
}

export type { VsCodeApi, WindowWithWebviewData };
export { getVsCodeApi, isExtensionToWebviewMessage, restorePersistedAppState };
