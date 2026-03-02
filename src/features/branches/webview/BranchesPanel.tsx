import React from "react";
import {
  ArrowDown,
  ArrowUp,
  GitFork,
  GitMerge,
  GitPullRequest,
  LoaderCircle
} from "lucide-react";
import { useWebviewAppContext } from "../../../app/webview/context/WebviewAppContext";
import { Button, Card } from "../../../shared/webview/components";

function BranchesPanel() {
  const {
    branches,
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
    postSwitchBranch
  } = useWebviewAppContext();
  const [isOtherBranchesOpen, setIsOtherBranchesOpen] = React.useState(false);

  React.useEffect(() => {
    if (otherBranches.some((branch) => branch.isCurrent)) {
      setIsOtherBranchesOpen(true);
    }
  }, [otherBranches]);

  function renderBranchRow(branch: (typeof branches)[number]) {
    const isCurrentBranch = branch.isCurrent;
    const hasOpenPullRequest = pullRequests.some(
      (pullRequest) => pullRequest.branchName === branch.name
    );
    const inferredParentBranchName = branch.inferredParentBranchName ?? baseBranchName;
    const branchActions = isCurrentBranch ? (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-label={`Pull ${branch.name} from origin`}
          className="inline-flex h-8 w-8 items-center justify-center p-0"
          disabled={gitOperationState.isInProgress}
          size="sm"
          title={`Pull ${branch.name} from origin`}
          variant="secondary"
          onClick={() => {
            postPullFromOrigin(branch.name);
          }}
        >
          <ArrowDown aria-hidden="true" size={20} />
        </Button>
        <Button
          aria-label={`Push ${branch.name} to origin`}
          className="inline-flex h-8 w-8 items-center justify-center p-0"
          disabled={gitOperationState.isInProgress}
          size="sm"
          title={`Push ${branch.name} to origin`}
          variant="secondary"
          onClick={() => {
            postPushToOrigin(branch.name);
          }}
        >
          <ArrowUp aria-hidden="true" size={20} />
        </Button>
        <Button
          aria-label={`Merge ${inferredParentBranchName} into ${branch.name}`}
          className="inline-flex h-8 w-8 items-center justify-center p-0"
          disabled={gitOperationState.isInProgress || branch.name === inferredParentBranchName}
          size="sm"
          variant="secondary"
          onClick={() => {
            postMergeFromBase(branch.name, inferredParentBranchName);
          }}
          title={`Merge ${inferredParentBranchName} into ${branch.name}`}
        >
          <GitMerge aria-hidden="true" size={20} />
        </Button>
        <Button
          aria-label={`Split ${branch.name}`}
          className="inline-flex h-8 w-8 items-center justify-center p-0"
          disabled={gitOperationState.isInProgress}
          size="sm"
          title={`Split ${branch.name}`}
          variant="secondary"
          onClick={() => {
            postSplitBranch(branch.name);
          }}
        >
          <GitFork aria-hidden="true" size={20} />
        </Button>
        {!hasOpenPullRequest ? (
          <Button
            aria-label={`Create draft PR from ${branch.name} to ${inferredParentBranchName}`}
            className="inline-flex h-8 w-8 items-center justify-center p-0"
            disabled={gitOperationState.isInProgress}
            size="sm"
            variant="secondary"
            onClick={() => {
              postCreateDraftPullRequest(branch.name, inferredParentBranchName);
            }}
            title={`Create draft PR from ${branch.name} to ${inferredParentBranchName}`}
          >
            <GitPullRequest aria-hidden="true" size={20} />
          </Button>
        ) : (
          <Button
            aria-label="Create draft PR unavailable: open PR already exists"
            className="inline-flex h-8 w-8 items-center justify-center p-0"
            disabled
            size="sm"
            title="Cannot create draft PR: open PR already exists"
            variant="secondary"
          >
            <GitPullRequest aria-hidden="true" size={20} />
          </Button>
        )}
      </div>
    ) : null;

    return (
      <div className="flex flex-col gap-2" key={branch.name}>
        {isCurrentBranch ? (
          <Card
            className="border-transparent bg-[color-mix(in_srgb,var(--vscode-button-secondaryBackground)_40%,transparent)]"
            padding="sm"
          >
            <div className="flex flex-col gap-2">
              <Button
                className="flex-1 text-left"
                size="lg"
                variant={branch.isCurrent ? "primary" : "secondary"}
                onClick={() => {
                  postSwitchBranch(branch.name);
                }}
              >
                <span className="mb-0.5 block font-semibold">{branch.name}</span>
                <span className="text-xs text-(--vscode-descriptionForeground)">
                  {branch.lastCommitDescription}
                  {branch.isCurrent ? " • current" : ""}
                </span>
              </Button>
              {branchActions}
            </div>
          </Card>
        ) : (
          <Button
            className="flex-1 text-left"
            size="lg"
            variant={branch.isCurrent ? "primary" : "secondary"}
            onClick={() => {
              postSwitchBranch(branch.name);
            }}
          >
            <span className="mb-0.5 block font-semibold">{branch.name}</span>
            <span className="text-xs text-(--vscode-descriptionForeground)">
              {branch.lastCommitDescription}
              {branch.isCurrent ? " • current" : ""}
            </span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <Card className="w-full px-3 py-2.5 font-bold" padding="none">
        <div className="flex items-center justify-between gap-2">
          <span>Recent Branches</span>
          {isLoading ? (
            <LoaderCircle
              aria-label="Refreshing branches"
              className="h-3.5 w-3.5 animate-spin text-(--vscode-descriptionForeground)"
            />
          ) : null}
        </div>
      </Card>
      {gitOperationState.notice ? (
        <Card className="w-full text-xs text-(--vscode-descriptionForeground)" padding="sm">
          {gitOperationState.notice}
        </Card>
      ) : null}

      <div className="flex min-h-14 flex-col gap-2">
        {primaryBranches.length === 0 ? (
          <div className="px-1 py-2.5 text-(--vscode-descriptionForeground)">
            {isLoading ? "Loading recent branches..." : "No recent branches yet."}
          </div>
        ) : (
          primaryBranches.map((branch) => renderBranchRow(branch))
        )}
        {otherBranches.length > 0 ? (
          <details
            className="rounded-md border border-(--vscode-panel-border) bg-(--vscode-editorWidget-background)"
            open={isOtherBranchesOpen}
            onToggle={(event) => {
              setIsOtherBranchesOpen(event.currentTarget.open);
            }}
          >
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium">
              Other branches ({otherBranches.length})
            </summary>
            <div className="border-t border-(--vscode-panel-border) px-2 py-2">
              <div className="flex min-h-10 flex-col gap-2">
                {otherBranches.map((branch) => renderBranchRow(branch))}
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </>
  );
}

export { BranchesPanel };
