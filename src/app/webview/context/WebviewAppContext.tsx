import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  ActiveTab,
  ExtensionToWebviewMessage,
  GitOperationState,
  GitHubAuthStatus,
  LogEntry,
  LogLevel,
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
  primaryBranches: RecentBranch[];
  otherBranches: RecentBranch[];
  pullRequests: PullRequestSummary[];
  logs: LogEntry[];
  isLogAutoScrollEnabled: boolean;
  activeLogLevels: LogLevel[];
  activeTab: ActiveTab;
  pullRequestFilter: PullRequestFilter;
  baseBranchName: string;
  isLoading: boolean;
  authStatus: GitHubAuthStatus;
  gitOperationState: GitOperationState;
  selectedBranchName: string | undefined;
  setIsLogAutoScrollEnabled(value: boolean): void;
  setActiveLogLevels(value: LogLevel[]): void;
  setActiveTab(value: ActiveTab): void;
  setPullRequestFilter(value: PullRequestFilter): void;
  setSelectedBranchName(value: string | undefined): void;
  postSwitchBranch(branchName: string): void;
  postMergeFromBase(branchName: string, baseBranchName?: string): void;
  postPullFromOrigin(branchName: string): void;
  postPushToOrigin(branchName: string): void;
  postSplitBranch(branchName: string, newBranchName?: string): void;
  postClearLogs(): void;
  postRequestRefresh(): void;
  postOpenPullRequest(url: string): void;
  postCreateDraftPullRequest(headBranchName: string, baseBranchName: string): void;
  postMergePullRequest(pullRequestId: number): void;
  postMarkPullRequestReady(pullRequestId: number): void;
  postMarkPullRequestDraft(pullRequestId: number): void;
  postSignInGithub(): void;
  postSwitchGithubAccount(): void;
  postOpenGithubAccounts(): void;
}

interface WebviewAppProviderProps {
  children: React.ReactNode;
}

const WebviewAppContext = createContext<WebviewAppStateContextValue | undefined>(undefined);

function normalizeLogLevels(levels: LogLevel[]) {
  const orderedLevels: LogLevel[] = ["info", "warn", "error"];
  const includedLevels = new Set<LogLevel>();
  for (const level of levels) {
    if (level === "info" || level === "warn" || level === "error") {
      includedLevels.add(level);
    }
  }
  return orderedLevels.filter((level) => includedLevels.has(level));
}

function getWebviewAssets(): WebviewAssets {
  const windowWithData = window as Window & { __RD_GIT_ASSETS__?: WebviewAssets };
  return {
    extensionVersion: windowWithData.__RD_GIT_ASSETS__?.extensionVersion ?? "unknown",
    extensionBuildCode: windowWithData.__RD_GIT_ASSETS__?.extensionBuildCode ?? "dev",
    viewMode: windowWithData.__RD_GIT_ASSETS__?.viewMode ?? "git"
  };
}

function getOptimisticBranchLists(
  branchName: string,
  currentPrimaryBranches: RecentBranch[],
  currentOtherBranches: RecentBranch[]
) {
  const primaryBranchCount = currentPrimaryBranches.length;
  const allBranches = [...currentPrimaryBranches, ...currentOtherBranches];
  const selectedBranch = allBranches.find((branch) => branch.name === branchName);
  const normalizedBranches = allBranches.map((branch) => {
    return {
      ...branch,
      isCurrent: branch.name === branchName
    };
  });
  if (!selectedBranch) {
    return {
      branches: normalizedBranches,
      primaryBranches: normalizedBranches.slice(0, primaryBranchCount),
      otherBranches: normalizedBranches.slice(primaryBranchCount)
    };
  }

  const normalizedPrimaryBranches = normalizedBranches.filter((branch) =>
    currentPrimaryBranches.some((primaryBranch) => primaryBranch.name === branch.name)
  );
  const normalizedOtherBranches = normalizedBranches.filter((branch) =>
    currentOtherBranches.some((otherBranch) => otherBranch.name === branch.name)
  );
  const isSelectedBranchInPrimary = normalizedPrimaryBranches.some((branch) => branch.name === branchName);
  if (isSelectedBranchInPrimary) {
    return {
      branches: normalizedBranches,
      primaryBranches: normalizedPrimaryBranches,
      otherBranches: normalizedOtherBranches
    };
  }

  const normalizedSelectedBranch = normalizedBranches.find((branch) => branch.name === branchName);
  if (!normalizedSelectedBranch) {
    return {
      branches: normalizedBranches,
      primaryBranches: normalizedPrimaryBranches,
      otherBranches: normalizedOtherBranches
    };
  }
  const nextPrimaryBranches = [...normalizedPrimaryBranches, normalizedSelectedBranch];
  const nextOtherBranches = normalizedOtherBranches.filter(
    (branch) => branch.name !== normalizedSelectedBranch.name
  );

  return {
    branches: [...nextPrimaryBranches, ...nextOtherBranches],
    primaryBranches: nextPrimaryBranches,
    otherBranches: nextOtherBranches
  };
}

function applySessionBranchPromotions(
  currentPrimaryBranches: RecentBranch[],
  currentOtherBranches: RecentBranch[],
  promotedBranchNames: string[]
) {
  if (promotedBranchNames.length === 0) {
    return {
      branches: [...currentPrimaryBranches, ...currentOtherBranches],
      primaryBranches: currentPrimaryBranches,
      otherBranches: currentOtherBranches
    };
  }

  const nextPrimaryBranches = [...currentPrimaryBranches];
  const nextOtherBranches = [...currentOtherBranches];
  for (const promotedBranchName of promotedBranchNames) {
    const otherBranchIndex = nextOtherBranches.findIndex((branch) => branch.name === promotedBranchName);
    if (otherBranchIndex < 0) {
      continue;
    }
    const [promotedBranch] = nextOtherBranches.splice(otherBranchIndex, 1);
    if (nextPrimaryBranches.some((branch) => branch.name === promotedBranch.name)) {
      continue;
    }
    nextPrimaryBranches.push(promotedBranch);
  }

  return {
    branches: [...nextPrimaryBranches, ...nextOtherBranches],
    primaryBranches: nextPrimaryBranches,
    otherBranches: nextOtherBranches
  };
}

function WebviewAppProvider({ children }: WebviewAppProviderProps) {
  const assets = useMemo(() => getWebviewAssets(), []);
  const vscode = useMemo(() => getVsCodeApi(window), []);
  const restoredState = useMemo(() => restorePersistedAppState(vscode), [vscode]);
  const [branches, setBranches] = useState<RecentBranch[]>(() => restoredState.branches ?? []);
  const [primaryBranches, setPrimaryBranches] = useState<RecentBranch[]>(() => {
    if (restoredState.primaryBranches) {
      return restoredState.primaryBranches;
    }
    return restoredState.branches ?? [];
  });
  const [otherBranches, setOtherBranches] = useState<RecentBranch[]>(
    () => restoredState.otherBranches ?? []
  );
  const [pullRequests, setPullRequests] = useState<PullRequestSummary[]>(
    () => restoredState.pullRequests ?? []
  );
  const [logs, setLogs] = useState<LogEntry[]>(() => restoredState.logs ?? []);
  const [isLogAutoScrollEnabled, setIsLogAutoScrollEnabled] = useState(
    () => restoredState.isLogAutoScrollEnabled ?? true
  );
  const [activeLogLevelsState, setActiveLogLevelsState] = useState<LogLevel[]>(() => {
    const restoredLevels = normalizeLogLevels(restoredState.activeLogLevels ?? []);
    if (restoredLevels.length === 0) {
      return ["info", "warn", "error"];
    }
    return restoredLevels;
  });
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
  const [gitOperationState, setGitOperationState] = useState<GitOperationState>({
    isInProgress: false,
    action: undefined,
    terminalName: undefined,
    notice: undefined
  });
  const [selectedBranchName, setSelectedBranchName] = useState<string | undefined>(
    () => restoredState.selectedBranchName
  );
  const sessionPromotedBranchNamesRef = useRef<string[]>([]);

  useEffect(() => {
    const nextState: PersistedAppState = {
      branches,
      primaryBranches,
      otherBranches,
      pullRequests,
      logs,
      isLogAutoScrollEnabled,
      activeLogLevels: activeLogLevelsState,
      activeTab,
      pullRequestFilter,
      baseBranchName,
      isLoading,
      authStatus,
      selectedBranchName
    };
    vscode.setState(nextState);
  }, [
    activeTab,
    authStatus,
    baseBranchName,
    branches,
    primaryBranches,
    otherBranches,
    isLoading,
    isLogAutoScrollEnabled,
    activeLogLevelsState,
    logs,
    pullRequestFilter,
    pullRequests,
    selectedBranchName,
    vscode
  ]);

  useEffect(() => {
    function handleMessage(event: MessageEvent<ExtensionToWebviewMessage>) {
      const message: unknown = event.data;
      if (!isExtensionToWebviewMessage(message)) {
        return;
      }
      if (message.type === "setBranches") {
        const sessionAdjustedBranchLists = applySessionBranchPromotions(
          message.primaryBranches,
          message.otherBranches,
          sessionPromotedBranchNamesRef.current
        );
        setBranches(sessionAdjustedBranchLists.branches);
        setPrimaryBranches(sessionAdjustedBranchLists.primaryBranches);
        setOtherBranches(sessionAdjustedBranchLists.otherBranches);
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
      if (message.type === "setGitOperationState") {
        setGitOperationState(message.gitOperationState);
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
    const isBranchInOtherBranches = otherBranches.some((branch) => branch.name === branchName);
    if (isBranchInOtherBranches) {
      const nextSessionPromotedBranchNames = sessionPromotedBranchNamesRef.current.filter(
        (promotedBranchName) => promotedBranchName !== branchName
      );
      nextSessionPromotedBranchNames.push(branchName);
      sessionPromotedBranchNamesRef.current = nextSessionPromotedBranchNames;
    }
    const optimisticBranchLists = getOptimisticBranchLists(
      branchName,
      primaryBranches,
      otherBranches
    );
    setBranches(optimisticBranchLists.branches);
    setPrimaryBranches(optimisticBranchLists.primaryBranches);
    setOtherBranches(optimisticBranchLists.otherBranches);
    setSelectedBranchName(branchName);
    setIsLoading(true);
    vscode.postMessage({ type: "switchBranch", branchName });
  }

  function postMergeFromBase(branchName: string, baseBranchName?: string) {
    vscode.postMessage({ type: "mergeFromBase", branchName, baseBranchName });
  }

  function postPullFromOrigin(branchName: string) {
    vscode.postMessage({ type: "pullFromOrigin", branchName });
  }

  function postRequestRefresh() {
    vscode.postMessage({ type: "requestRefresh" });
  }

  function postClearLogs() {
    setLogs([]);
    vscode.postMessage({ type: "clearLogs" });
  }

  function setActiveLogLevels(levels: LogLevel[]) {
    const normalizedLevels = normalizeLogLevels(levels);
    if (normalizedLevels.length === 0) {
      return;
    }
    setActiveLogLevelsState(normalizedLevels);
    vscode.postMessage({
      type: "setLogLevelFilters",
      logLevels: normalizedLevels
    });
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

  function postMarkPullRequestDraft(pullRequestId: number) {
    vscode.postMessage({ type: "markPullRequestDraft", pullRequestId });
  }

  function postPushToOrigin(branchName: string) {
    vscode.postMessage({ type: "pushToOrigin", branchName });
  }

  function postSplitBranch(branchName: string, newBranchName?: string) {
    vscode.postMessage({ type: "splitBranch", branchName, newBranchName });
  }

  function postCreateDraftPullRequest(headBranchName: string, baseBranchName: string) {
    vscode.postMessage({ type: "createDraftPullRequest", headBranchName, baseBranchName });
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
    primaryBranches,
    otherBranches,
    pullRequests,
    logs,
    isLogAutoScrollEnabled,
    activeLogLevels: activeLogLevelsState,
    activeTab,
    pullRequestFilter,
    baseBranchName,
    isLoading,
    authStatus,
    gitOperationState,
    selectedBranchName,
    setIsLogAutoScrollEnabled,
    setActiveLogLevels,
    setActiveTab,
    setPullRequestFilter,
    setSelectedBranchName,
    postSwitchBranch,
    postMergeFromBase,
    postPullFromOrigin,
    postPushToOrigin,
    postSplitBranch,
    postClearLogs,
    postRequestRefresh,
    postOpenPullRequest,
    postCreateDraftPullRequest,
    postMergePullRequest,
    postMarkPullRequestReady,
    postMarkPullRequestDraft,
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
