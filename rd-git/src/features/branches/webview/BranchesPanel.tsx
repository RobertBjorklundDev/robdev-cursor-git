import React from "react";
import { useWebviewAppContext } from "../../../app/webview/context/WebviewAppContext";
import type { RecentBranch } from "../../../shared/webview/contracts";
import { BranchListSection } from "./BranchListSection";
import { BranchRow } from "./BranchRow";

function BranchesPanel() {
  const {
    primaryBranches,
    otherBranches,
    baseBranchName,
    gitOperationState,
    isLoading,
    postPullFromOrigin,
    postPushToOrigin,
    postMergeFromBase,
    postSplitBranch,
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
    const inferredParentBranchName =
      branch.inferredParentBranchName ?? baseBranchName;
    const shouldShowMergeAction = branch.name !== baseBranchName;
    return (
      <BranchRow
        key={branch.name}
        branch={branch}
        inferredParentBranchName={inferredParentBranchName}
        shouldShowMergeAction={shouldShowMergeAction}
        isGitOperationInProgress={gitOperationState.isInProgress}
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
