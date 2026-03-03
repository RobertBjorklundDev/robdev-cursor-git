import React from "react";
import { GitMerge, Pencil } from "lucide-react";
import type { PullRequestSummary } from "../../../shared/webview/contracts";
import { Button, IconActionButton } from "../../../shared/webview/components";
import { getPullRequestBadge, getPullRequestStatus } from "./pullRequestPresentation";

interface PullRequestRowProps {
  pullRequest: PullRequestSummary;
  onOpenPullRequest(url: string): void;
  onMarkPullRequestReady(pullRequestId: number): void;
  onMarkPullRequestDraft(pullRequestId: number): void;
  onMergePullRequest(pullRequestId: number): void;
}

function PullRequestRow({
  pullRequest,
  onOpenPullRequest,
  onMarkPullRequestReady,
  onMarkPullRequestDraft,
  onMergePullRequest
}: PullRequestRowProps) {
  const badge = getPullRequestBadge(pullRequest);
  const StatusIcon = badge.icon;

  return (
    <div className="flex items-stretch gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-1">
      <Button
        className="flex flex-1 flex-col items-start justify-start gap-0.5 text-left"
        onClick={() => {
          onOpenPullRequest(pullRequest.url);
        }}
        size="md"
        variant="ghost"
        width="full"
      >
        <span className="block text-sm font-medium leading-tight">{pullRequest.title}</span>
        <span className="flex items-center gap-1.5 text-[11px] leading-tight">
          <span className="text-muted-foreground">{pullRequest.branchName}</span>
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

      {pullRequest.isDraft ? (
        <IconActionButton
          buttonClassName="w-8 self-stretch"
          label="Mark pull request as ready for review"
          onClick={() => {
            onMarkPullRequestReady(pullRequest.id);
          }}
        >
          <Pencil aria-hidden="true" size={14} />
        </IconActionButton>
      ) : (
        <div className="flex gap-1.5">
          <IconActionButton
            buttonClassName="w-8 self-stretch"
            label="Convert pull request to draft"
            onClick={() => {
              onMarkPullRequestDraft(pullRequest.id);
            }}
          >
            <Pencil aria-hidden="true" size={14} />
          </IconActionButton>
          <IconActionButton
            buttonClassName="w-8 self-stretch"
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
            <GitMerge aria-hidden="true" size={14} />
          </IconActionButton>
        </div>
      )}
    </div>
  );
}

export { PullRequestRow };
