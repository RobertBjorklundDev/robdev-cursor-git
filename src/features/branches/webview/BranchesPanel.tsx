import React from "react";
import { LoaderCircle } from "lucide-react";
import { useWebviewAppContext } from "../../../app/webview/context/WebviewAppContext";
import type { RecentBranch } from "../../../shared/webview/contracts";
import { BranchListSection } from "./BranchListSection";
import { BranchRow } from "./BranchRow";

function BranchesPanel() {
  const {
    primaryBranches,
    otherBranches,
    baseBranchName,
    pullRequests,
    gitOperationState,
    isLoading,
    postPullFromOrigin,
    postPushToOrigin,
    postMergeFromBase,
    postSplitBranch,
    postCreateDraftPullRequest,
    postSwitchBranch,
  } = useWebviewAppContext();
  const [otherBranchesAccordionValue, setOtherBranchesAccordionValue] =
    React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (otherBranches.some((branch) => branch.isCurrent)) {
      setOtherBranchesAccordionValue("other-branches");
    }
  }, [otherBranches]);

  function renderBranchRow(branch: RecentBranch) {
    const hasOpenPullRequest = pullRequests.some(
      (pullRequest) => pullRequest.branchName === branch.name,
    );
    const inferredParentBranchName =
      branch.inferredParentBranchName ?? baseBranchName;
    return (
      <BranchRow
        key={branch.name}
        branch={branch}
        hasOpenPullRequest={hasOpenPullRequest}
        inferredParentBranchName={inferredParentBranchName}
        isGitOperationInProgress={gitOperationState.isInProgress}
        onCreateDraftPullRequest={postCreateDraftPullRequest}
        onMergeFromBase={postMergeFromBase}
        onPullFromOrigin={postPullFromOrigin}
        onPushToOrigin={postPushToOrigin}
        onSplitBranch={postSplitBranch}
        onSwitchBranch={postSwitchBranch}
      />
    );
  }

  return (
    <>
      {gitOperationState.notice ? (
        <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-[11px] text-muted-foreground">
          {gitOperationState.notice}
        </div>
      ) : null}

      <BranchListSection
        isLoading={isLoading}
        otherBranches={otherBranches}
        otherBranchesAccordionValue={otherBranchesAccordionValue}
        primaryBranches={primaryBranches}
        onOtherBranchesAccordionValueChange={setOtherBranchesAccordionValue}
        renderBranchRow={renderBranchRow}
      />
    </>
  );
}

export { BranchesPanel };
