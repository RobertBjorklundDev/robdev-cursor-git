import React from "react";
import type { PullRequestFilter } from "../../../shared/webview/contracts";
import { Button } from "../../../shared/webview/components";

type AssigneeFilter = "mine" | "others" | "unassigned";

interface PullRequestFiltersProps {
  pullRequestFilter: PullRequestFilter;
  assigneeFilter: AssigneeFilter;
  onPullRequestFilterChange(value: PullRequestFilter): void;
  onAssigneeFilterChange(value: AssigneeFilter): void;
}

function PullRequestFilters({
  pullRequestFilter,
  assigneeFilter,
  onPullRequestFilterChange,
  onAssigneeFilterChange
}: PullRequestFiltersProps) {
  return (
    <>
      <div className="flex gap-1.5">
        <Button
          className="flex-1"
          size="sm"
          variant={pullRequestFilter === "ready" ? "primary" : "secondary"}
          onClick={() => {
            onPullRequestFilterChange("ready");
          }}
        >
          Ready
        </Button>
        <Button
          className="flex-1"
          size="sm"
          variant={pullRequestFilter === "draft" ? "primary" : "secondary"}
          onClick={() => {
            onPullRequestFilterChange("draft");
          }}
        >
          Draft
        </Button>
      </div>

      <div className="flex gap-1.5">
        <Button
          className="flex-1"
          size="sm"
          variant={assigneeFilter === "mine" ? "primary" : "secondary"}
          onClick={() => {
            onAssigneeFilterChange("mine");
          }}
        >
          Assigned to me
        </Button>
        <Button
          className="flex-1"
          size="sm"
          variant={assigneeFilter === "others" ? "primary" : "secondary"}
          onClick={() => {
            onAssigneeFilterChange("others");
          }}
        >
          Assigned to others
        </Button>
        <Button
          className="flex-1"
          size="sm"
          variant={assigneeFilter === "unassigned" ? "primary" : "secondary"}
          onClick={() => {
            onAssigneeFilterChange("unassigned");
          }}
        >
          Unassigned
        </Button>
      </div>
    </>
  );
}

export type { AssigneeFilter };
export { PullRequestFilters };
