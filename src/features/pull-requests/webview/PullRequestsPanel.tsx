import React, { useMemo, useState } from "react";
import { GitMerge, Pencil } from "lucide-react";
import { useWebviewAppContext } from "../../../app/webview/context/WebviewAppContext";
import { Button, Card } from "../../../shared/webview/components";
import { getPullRequestBadge, getPullRequestStatus } from "./pullRequestPresentation";

function PullRequestsPanel() {
  const {
    authStatus,
    isLoading,
    pullRequests,
    pullRequestFilter,
    postMergePullRequest,
    postMarkPullRequestReady,
    postOpenGithubAccounts,
    postOpenPullRequest,
    postSignInGithub,
    setPullRequestFilter
  } = useWebviewAppContext();
  const [assigneeFilter, setAssigneeFilter] = useState<"mine" | "others" | "unassigned">("mine");

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
    <>
      <div className="my-1 h-px w-full bg-(--vscode-panel-border)" />

      <Card className="w-full px-3 py-2.5 font-bold" padding="none">
        Current PRs
      </Card>

      {!authStatus.isProviderAvailable ? (
        <Card className="px-3 py-2.5 text-(--vscode-descriptionForeground)" padding="none">
          <div className="mb-2">GitHub authentication provider is not available in this host.</div>
          <Button variant="secondary" onClick={postOpenGithubAccounts}>
            Open Accounts
          </Button>
        </Card>
      ) : !authStatus.isAuthenticated ? (
        <Card className="px-3 py-2.5 text-(--vscode-descriptionForeground)" padding="none">
          <div className="mb-2">Sign in to GitHub to load and merge pull requests.</div>
          <Button variant="secondary" onClick={postSignInGithub}>
            Sign in with GitHub
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              variant={pullRequestFilter === "ready" ? "primary" : "secondary"}
              onClick={() => {
                setPullRequestFilter("ready");
              }}
            >
              Ready
            </Button>
            <Button
              className="flex-1"
              variant={pullRequestFilter === "draft" ? "primary" : "secondary"}
              onClick={() => {
                setPullRequestFilter("draft");
              }}
            >
              Draft
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              variant={assigneeFilter === "mine" ? "primary" : "secondary"}
              onClick={() => {
                setAssigneeFilter("mine");
              }}
            >
              Assigned to me
            </Button>
            <Button
              className="flex-1"
              variant={assigneeFilter === "others" ? "primary" : "secondary"}
              onClick={() => {
                setAssigneeFilter("others");
              }}
            >
              Assigned to others
            </Button>
            <Button
              className="flex-1"
              variant={assigneeFilter === "unassigned" ? "primary" : "secondary"}
              onClick={() => {
                setAssigneeFilter("unassigned");
              }}
            >
              Unassigned
            </Button>
          </div>

          <div className="flex min-h-14 flex-col gap-2">
            {isLoading && pullRequests.length === 0 ? (
              <div className="px-1 py-2.5 text-(--vscode-descriptionForeground)">
                Loading pull requests...
              </div>
            ) : visiblePullRequests.length === 0 ? (
              <div className="px-1 py-2.5 text-(--vscode-descriptionForeground)">
                No {pullRequestFilter} pull requests for this assignee filter.
              </div>
            ) : (
              visiblePullRequests.map((pullRequest) => (
                <div className="flex items-stretch gap-2" key={pullRequest.id}>
                  <Button
                    className="text-left"
                    onClick={() => {
                      postOpenPullRequest(pullRequest.url);
                    }}
                    size="lg"
                    variant="secondary"
                    width="full"
                  >
                    <span className="mb-0.5 block font-semibold">{pullRequest.title}</span>
                    {(() => {
                      const badge = getPullRequestBadge(pullRequest);
                      const StatusIcon = badge.icon;
                      return (
                        <span className="flex items-center gap-2 text-xs">
                          <span className="text-(--vscode-descriptionForeground)">
                            {pullRequest.branchName}
                          </span>
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
                  </Button>

                  {pullRequest.isDraft ? (
                    <Button
                      className="w-8 self-stretch p-0"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        postMarkPullRequestReady(pullRequest.id);
                      }}
                      title="Mark pull request as ready for review"
                    >
                      <Pencil aria-hidden="true" className="mx-auto" size={14} />
                    </Button>
                  ) : (
                    <Button
                      className="w-8 self-stretch p-0"
                      size="sm"
                      variant="secondary"
                      disabled={pullRequest.mergeable !== true}
                      onClick={() => {
                        postMergePullRequest(pullRequest.id);
                      }}
                      title={
                        pullRequest.mergeable === true
                          ? "Merge pull request"
                          : "Pull request is not mergeable"
                      }
                    >
                      <GitMerge aria-hidden="true" className="mx-auto" size={14} />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}

export { PullRequestsPanel };
