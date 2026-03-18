import React from "react";
import type { PullRequestFilter } from "../../../shared/webview/contracts";
import { ListStateMessage } from "../../../shared/webview/components";

interface PullRequestListStateProps {
  isLoading: boolean;
  pullRequestsCount: number;
  visiblePullRequestsCount: number;
  pullRequestFilter: PullRequestFilter;
  children: React.ReactNode;
}

function PullRequestListState({
  isLoading,
  pullRequestsCount,
  visiblePullRequestsCount,
  pullRequestFilter,
  children
}: PullRequestListStateProps) {
  if (isLoading && pullRequestsCount === 0) {
    return <ListStateMessage>Loading pull requests...</ListStateMessage>;
  }

  if (visiblePullRequestsCount === 0) {
    return (
      <ListStateMessage>
        No {pullRequestFilter} pull requests for this assignee filter.
      </ListStateMessage>
    );
  }

  return <>{children}</>;
}

export { PullRequestListState };
