import React from "react";
import { ExternalLink, GitMerge, Pencil } from "lucide-react";
import type { PullRequestSummary } from "../../../shared/webview/contracts";
import { Button, IconActionButton } from "../../../shared/webview/components";
import { getPullRequestBadge, getPullRequestStatus } from "./pullRequestPresentation";

interface PullRequestRowProps {
  pullRequest: PullRequestSummary;
  isCurrentBranch: boolean;
  onSwitchBranch(branchName: string): void;
  onOpenPullRequest(url: string): void;
  onMarkPullRequestReady(pullRequestId: number): void;
  onMarkPullRequestDraft(pullRequestId: number): void;
  onMergePullRequest(pullRequestId: number): void;
}

function PullRequestRow({
  pullRequest,
  isCurrentBranch,
  onSwitchBranch,
  onOpenPullRequest,
  onMarkPullRequestReady,
  onMarkPullRequestDraft,
  onMergePullRequest
}: PullRequestRowProps) {
  const badge = getPullRequestBadge(pullRequest);
  const StatusIcon = badge.icon;

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-border/60 bg-muted/40 p-1.5">
        <div className="flex flex-col gap-2">
          <Button
            className="flex flex-1 flex-col items-start justify-start gap-0.5 text-left"
            onClick={() => {
              onSwitchBranch(pullRequest.branchName);
            }}
            size="md"
            variant={isCurrentBranch ? "primary" : "ghost"}
            width="full"
          >
            <span className="block text-sm font-medium leading-tight">{pullRequest.title}</span>
            <span className="flex items-center gap-1.5 text-[11px] leading-tight">
              <span className="text-muted-foreground">{pullRequest.branchName}</span>
              {isCurrentBranch ? (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">current</span>
                </>
              ) : null}
              <span className="text-muted-foreground">•</span>
              <span
                className="flex items-center gap-1.5 font-semibold lowercase"
                style={{ color: badge.color }}
              >
                <StatusIcon className="shrink-0" size={14} />
                <span>{badge.label}</span>
              </span>
              <span className="text-muted-foreground">
                • {getPullRequestStatus(pullRequest)}
              </span>
            </span>
          </Button>

          <div className="flex flex-wrap gap-3">
            <IconActionButton
              label="Open pull request on GitHub"
              onClick={() => {
                onOpenPullRequest(pullRequest.url);
              }}
            >
              <ExternalLink aria-hidden="true" size={18} />
            </IconActionButton>
            {pullRequest.isDraft ? (
              <IconActionButton
                label="Mark pull request as ready for review"
                onClick={() => {
                  onMarkPullRequestReady(pullRequest.id);
                }}
              >
                <Pencil aria-hidden="true" size={18} />
              </IconActionButton>
            ) : (
              <>
                <IconActionButton
                  label="Convert pull request to draft"
                  onClick={() => {
                    onMarkPullRequestDraft(pullRequest.id);
                  }}
                >
                  <Pencil aria-hidden="true" size={18} />
                </IconActionButton>
                <IconActionButton
                  disabled={pullRequest.mergeable !== true}
                  label={
                    pullRequest.mergeable === true
                      ? "Merge pull request"
                      : "Pull request is not mergeable"
                  }
                  onClick={() => {
                    onMergePullRequest(pullRequest.id);
                  }}
                >
                  <GitMerge aria-hidden="true" size={18} />
                </IconActionButton>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { PullRequestRow };
