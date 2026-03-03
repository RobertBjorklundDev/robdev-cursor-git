import React, { useMemo, useState } from "react";
import { useWebviewAppContext } from "../../../app/webview/context/WebviewAppContext";
import { PullRequestAuthGate } from "./PullRequestAuthGate";
import { AssigneeFilter, PullRequestFilters } from "./PullRequestFilters";
import { PullRequestListState } from "./PullRequestListState";
import { PullRequestRow } from "./PullRequestRow";

function PullRequestsPanel() {
  const {
    authStatus,
    isLoading,
    pullRequests,
    pullRequestFilter,
    postMergePullRequest,
    postMarkPullRequestReady,
    postMarkPullRequestDraft,
    postOpenGithubAccounts,
    postOpenPullRequest,
    postSignInGithub,
    setPullRequestFilter
  } = useWebviewAppContext();
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("mine");

  const visiblePullRequests = useMemo(() => {
    return pullRequests
      .filter((pullRequest) => {
        if (pullRequestFilter === "draft") {
          return pullRequest.isDraft;
        }
        return !pullRequest.isDraft;
      })
      .filter((pullRequest) => {
        const isAssignedToViewer = pullRequest.isAssignedToViewer === true;
        const assigneeLogins = pullRequest.assigneeLogins ?? [];
        if (assigneeFilter === "mine") {
          return isAssignedToViewer;
        }
        if (assigneeFilter === "others") {
          return assigneeLogins.length > 0 && !isAssignedToViewer;
        }
        return assigneeLogins.length === 0;
      })
      .sort((firstPullRequest, secondPullRequest) => {
        const firstUpdatedAt = new Date(firstPullRequest.updatedAtIso ?? "").getTime();
        const secondUpdatedAt = new Date(secondPullRequest.updatedAtIso ?? "").getTime();
        return (
          (Number.isFinite(secondUpdatedAt) ? secondUpdatedAt : 0) -
          (Number.isFinite(firstUpdatedAt) ? firstUpdatedAt : 0)
        );
      });
  }, [assigneeFilter, pullRequestFilter, pullRequests]);

  return (
    <PullRequestAuthGate
      authStatus={authStatus}
      onOpenGithubAccounts={postOpenGithubAccounts}
      onSignInGithub={postSignInGithub}
    >
      <>
        <PullRequestFilters
          assigneeFilter={assigneeFilter}
          pullRequestFilter={pullRequestFilter}
          onAssigneeFilterChange={setAssigneeFilter}
          onPullRequestFilterChange={setPullRequestFilter}
        />
        <div className="flex min-h-14 flex-col gap-1.5">
          <PullRequestListState
            isLoading={isLoading}
            pullRequestFilter={pullRequestFilter}
            pullRequestsCount={pullRequests.length}
            visiblePullRequestsCount={visiblePullRequests.length}
          >
            {visiblePullRequests.map((pullRequest) => (
              <PullRequestRow
                key={pullRequest.id}
                pullRequest={pullRequest}
                onMarkPullRequestDraft={postMarkPullRequestDraft}
                onMarkPullRequestReady={postMarkPullRequestReady}
                onMergePullRequest={postMergePullRequest}
                onOpenPullRequest={postOpenPullRequest}
              />
            ))}
          </PullRequestListState>
        </div>
      </>
    </PullRequestAuthGate>
  );
}

export { PullRequestsPanel };
