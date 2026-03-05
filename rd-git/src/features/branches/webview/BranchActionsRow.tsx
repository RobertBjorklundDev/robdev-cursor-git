import React from "react";
import {
  ArrowDown,
  ArrowUp,
  GitFork,
  GitMerge
} from "lucide-react";
import type { RecentBranch } from "../../../shared/webview/contracts";
import { IconActionButton } from "../../../shared/webview/components";

interface BranchActionsRowProps {
  branch: RecentBranch;
  inferredParentBranchName: string;
  shouldShowMergeAction: boolean;
  isGitOperationInProgress: boolean;
  onPullFromOrigin(branchName: string): void;
  onPushToOrigin(branchName: string): void;
  onMergeFromBase(branchName: string, baseBranchName: string): void;
  onSplitBranch(branchName: string): void;
}

function BranchActionsRow({
  branch,
  inferredParentBranchName,
  shouldShowMergeAction,
  isGitOperationInProgress,
  onPullFromOrigin,
  onPushToOrigin,
  onMergeFromBase,
  onSplitBranch,
}: BranchActionsRowProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <IconActionButton
        disabled={isGitOperationInProgress}
        label={`Pull ${branch.name} from origin`}
        onClick={() => {
          onPullFromOrigin(branch.name);
        }}
      >
        <ArrowDown aria-hidden="true" size={18} />
      </IconActionButton>
      <IconActionButton
        disabled={isGitOperationInProgress}
        label={`Push ${branch.name} to origin`}
        onClick={() => {
          onPushToOrigin(branch.name);
        }}
      >
        <ArrowUp aria-hidden="true" size={18} />
      </IconActionButton>
      {shouldShowMergeAction ? (
        <IconActionButton
          disabled={
            isGitOperationInProgress || branch.name === inferredParentBranchName
          }
          label={`Merge ${inferredParentBranchName} into ${branch.name}`}
          onClick={() => {
            onMergeFromBase(branch.name, inferredParentBranchName);
          }}
        >
          <GitMerge aria-hidden="true" size={18} />
        </IconActionButton>
      ) : null}
      <IconActionButton
        disabled={isGitOperationInProgress}
        label={`Split ${branch.name}`}
        onClick={() => {
          onSplitBranch(branch.name);
        }}
      >
        <GitFork aria-hidden="true" size={18} />
      </IconActionButton>
    </div>
  );
}

export { BranchActionsRow };
