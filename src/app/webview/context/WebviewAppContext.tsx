import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  ActiveTab,
  ExtensionToWebviewMessage,
  GitHubAuthStatus,
  LogEntry,
  PersistedAppState,
  PullRequestFilter,
  PullRequestSummary,
  RecentBranch,
  WebviewAssets
} from "../../../shared/webview/contracts";
import {
  getVsCodeApi,
  isExtensionToWebviewMessage,
  restorePersistedAppState
} from "../../../shared/webview/vscodeApi";

interface WebviewAppStateContextValue {
  assets: WebviewAssets;
  branches: RecentBranch[];
  pullRequests: PullRequestSummary[];
  logs: LogEntry[];
  isLogAutoScrollEnabled: boolean;
  activeTab: ActiveTab;
  pullRequestFilter: PullRequestFilter;
  baseBranchName: string;
  isLoading: boolean;
  authStatus: GitHubAuthStatus;
  setIsLogAutoScrollEnabled(value: boolean): void;
  setActiveTab(value: ActiveTab): void;
  setPullRequestFilter(value: PullRequestFilter): void;
  postSwitchBranch(branchName: string): void;
  postMergeFromBase(branchName: string): void;
  postPullFromOrigin(branchName: string): void;
  postRequestRefresh(): void;
  postOpenPullRequest(url: string): void;
  postMergePullRequest(pullRequestId: number): void;
  postMarkPullRequestReady(pullRequestId: number): void;
  postSignInGithub(): void;
  postSwitchGithubAccount(): void;
  postOpenGithubAccounts(): void;
}

interface WebviewAppProviderProps {
  children: React.ReactNode;
}

const WebviewAppContext = createContext<WebviewAppStateContextValue | undefined>(undefined);

function getWebviewAssets(): WebviewAssets {
  const windowWithData = window as Window & { __BRANCH_SWITCHER_ASSETS__?: WebviewAssets };
  return {
    extensionVersion: windowWithData.__BRANCH_SWITCHER_ASSETS__?.extensionVersion ?? "unknown",
    extensionBuildCode: windowWithData.__BRANCH_SWITCHER_ASSETS__?.extensionBuildCode ?? "dev"
  };
}

function WebviewAppProvider({ children }: WebviewAppProviderProps) {
  const assets = useMemo(() => getWebviewAssets(), []);
  const vscode = useMemo(() => getVsCodeApi(window), []);
  const restoredState = useMemo(() => restorePersistedAppState(vscode), [vscode]);
  const [branches, setBranches] = useState<RecentBranch[]>(() => restoredState.branches ?? []);
  const [pullRequests, setPullRequests] = useState<PullRequestSummary[]>(
    () => restoredState.pullRequests ?? []
  );
  const [logs, setLogs] = useState<LogEntry[]>(() => restoredState.logs ?? []);
  const [isLogAutoScrollEnabled, setIsLogAutoScrollEnabled] = useState(
    () => restoredState.isLogAutoScrollEnabled ?? true
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => restoredState.activeTab ?? "main");
  const [pullRequestFilter, setPullRequestFilter] = useState<PullRequestFilter>(
    () => restoredState.pullRequestFilter ?? "ready"
  );
  const [baseBranchName, setBaseBranchName] = useState(() => restoredState.baseBranchName ?? "main");
  const [isLoading, setIsLoading] = useState(() => restoredState.isLoading ?? true);
  const [authStatus, setAuthStatus] = useState<GitHubAuthStatus>({
    isProviderAvailable: restoredState.authStatus?.isProviderAvailable ?? true,
    isAuthenticated: restoredState.authStatus?.isAuthenticated ?? false
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
      authStatus
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
    vscode
  ]);

  useEffect(() => {
    function handleMessage(event: MessageEvent<ExtensionToWebviewMessage>) {
      const message: unknown = event.data;
      if (!isExtensionToWebviewMessage(message)) {
        return;
      }
      if (message.type === "setBranches") {
        setBranches(message.branches);
        setBaseBranchName(message.baseBranchName);
        setIsLoading(message.isLoading);
        return;
      }
      if (message.type === "setLoading") {
        setIsLoading(message.isLoading);
        return;
      }
      if (message.type === "setPullRequests") {
        setPullRequests(message.pullRequests);
        return;
      }
      if (message.type === "setAuthStatus") {
        setAuthStatus(message.authStatus);
        return;
      }
      if (message.type === "setLogs") {
        setLogs(message.logs);
        return;
      }
      if (message.type === "appendLog") {
        setLogs((previousLogs) => [...previousLogs, message.log]);
      }
    }

    window.addEventListener("message", handleMessage as EventListener);
    vscode.postMessage({ type: "ready" });
    return () => {
      window.removeEventListener("message", handleMessage as EventListener);
    };
  }, [vscode]);

  function postSwitchBranch(branchName: string) {
    vscode.postMessage({ type: "switchBranch", branchName });
  }

  function postMergeFromBase(branchName: string) {
    vscode.postMessage({ type: "mergeFromBase", branchName });
  }

  function postPullFromOrigin(branchName: string) {
    vscode.postMessage({ type: "pullFromOrigin", branchName });
  }

  function postRequestRefresh() {
    vscode.postMessage({ type: "requestRefresh" });
  }

  function postOpenPullRequest(url: string) {
    vscode.postMessage({ type: "openPullRequest", pullRequestUrl: url });
  }

  function postMergePullRequest(pullRequestId: number) {
    vscode.postMessage({ type: "mergePullRequest", pullRequestId });
  }

  function postMarkPullRequestReady(pullRequestId: number) {
    vscode.postMessage({ type: "markPullRequestReady", pullRequestId });
  }

  function postSignInGithub() {
    vscode.postMessage({ type: "signInGithub" });
  }

  function postSwitchGithubAccount() {
    vscode.postMessage({ type: "switchGithubAccount" });
  }

  function postOpenGithubAccounts() {
    vscode.postMessage({ type: "openGithubAccounts" });
  }

  const value: WebviewAppStateContextValue = {
    assets,
    branches,
    pullRequests,
    logs,
    isLogAutoScrollEnabled,
    activeTab,
    pullRequestFilter,
    baseBranchName,
    isLoading,
    authStatus,
    setIsLogAutoScrollEnabled,
    setActiveTab,
    setPullRequestFilter,
    postSwitchBranch,
    postMergeFromBase,
    postPullFromOrigin,
    postRequestRefresh,
    postOpenPullRequest,
    postMergePullRequest,
    postMarkPullRequestReady,
    postSignInGithub,
    postSwitchGithubAccount,
    postOpenGithubAccounts
  };

  return <WebviewAppContext.Provider value={value}>{children}</WebviewAppContext.Provider>;
}

function useWebviewAppContext() {
  const context = useContext(WebviewAppContext);
  if (!context) {
    throw new Error("useWebviewAppContext must be used within WebviewAppProvider.");
  }
  return context;
}

export { WebviewAppProvider, useWebviewAppContext };
