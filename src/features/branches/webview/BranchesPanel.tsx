import React from "react";
import { ArrowDownToLine, GitMerge, LoaderCircle } from "lucide-react";
import { useWebviewAppContext } from "../../../app/webview/context/WebviewAppContext";
import { Button, Card } from "../../../shared/webview/components";

function BranchesPanel() {
  const {
    branches,
    baseBranchName,
    gitOperationState,
    isLoading,
    postMergeFromBase,
    postPullFromOrigin,
    postSwitchBranch
  } = useWebviewAppContext();

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
        {branches.length === 0 ? (
          <div className="px-1 py-2.5 text-(--vscode-descriptionForeground)">
            {isLoading ? "Loading recent branches..." : "No recent branches yet."}
          </div>
        ) : (
          branches.map((branch) => (
            <div className="flex items-stretch gap-2" key={branch.name}>
              {branch.isCurrent ? (
                <Button
                  className="w-8 self-stretch p-0"
                  disabled={gitOperationState.isInProgress}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    postPullFromOrigin(branch.name);
                  }}
                  title={
                    gitOperationState.isInProgress
                      ? "Git action in progress. Check terminal."
                      : `Pull ${branch.name} from origin`
                  }
                >
                  <ArrowDownToLine aria-hidden="true" className="mx-auto" size={14} />
                </Button>
              ) : null}
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

              {branch.isCurrent && branch.name !== baseBranchName ? (
                <Button
                  className="w-8 self-stretch p-0"
                  disabled={gitOperationState.isInProgress}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    postMergeFromBase(branch.name);
                  }}
                  title={
                    gitOperationState.isInProgress
                      ? "Git action in progress. Check terminal."
                      : `Merge ${baseBranchName} into ${branch.name}`
                  }
                >
                  <GitMerge aria-hidden="true" className="mx-auto" size={14} />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </>
  );
}

export { BranchesPanel };
