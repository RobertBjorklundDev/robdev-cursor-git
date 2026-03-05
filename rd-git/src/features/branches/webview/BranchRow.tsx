import React from "react";
import type { RecentBranch } from "../../../shared/webview/contracts";
import { Button } from "../../../shared/webview/components";
import { BranchActionsRow } from "./BranchActionsRow";

interface BranchRowProps {
  branch: RecentBranch;
  inferredParentBranchName: string;
  shouldShowMergeAction: boolean;
  isGitOperationInProgress: boolean;
  onSwitchBranch(branchName: string): void;
  onPullFromOrigin(branchName: string): void;
  onPushToOrigin(branchName: string): void;
  onMergeFromBase(branchName: string, baseBranchName: string): void;
  onSplitBranch(branchName: string): void;
}

function BranchRow({
  branch,
  inferredParentBranchName,
  shouldShowMergeAction,
  isGitOperationInProgress,
  onSwitchBranch,
  onPullFromOrigin,
  onPushToOrigin,
  onMergeFromBase,
  onSplitBranch,
}: BranchRowProps) {
  if (branch.isCurrent) {
    return (
      <div className="flex flex-col gap-2">
        <div className="rounded-lg border border-border/60 bg-muted/40 p-1.5">
          <div className="flex flex-col gap-2">
            <Button
              className="flex flex-1 flex-col items-start justify-start gap-0.5 text-left"
              size="md"
              variant="primary"
              onClick={() => {
                onSwitchBranch(branch.name);
              }}
            >
              <span className="block text-sm font-medium leading-tight">
                {branch.name}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {branch.lastCommitDescription}
                {branch.isCurrent ? " • current" : ""}
              </span>
            </Button>
            <BranchActionsRow
              branch={branch}
              inferredParentBranchName={inferredParentBranchName}
              shouldShowMergeAction={shouldShowMergeAction}
              isGitOperationInProgress={isGitOperationInProgress}
              onMergeFromBase={onMergeFromBase}
              onPullFromOrigin={onPullFromOrigin}
              onPushToOrigin={onPushToOrigin}
              onSplitBranch={onSplitBranch}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="flex flex-1 flex-col items-start justify-start gap-0.5 text-left"
        size="md"
        variant="ghost"
        onClick={() => {
          onSwitchBranch(branch.name);
        }}
      >
        <span className="block text-sm font-medium leading-tight">
          {branch.name}
        </span>
        <span className="text-[11px] leading-tight text-muted-foreground">
          {branch.lastCommitDescription}
          {branch.isCurrent ? " • current" : ""}
        </span>
      </Button>
    </div>
  );
}

export { BranchRow };
