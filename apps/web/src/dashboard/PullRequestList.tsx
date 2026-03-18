import { useState } from "react";
import { RefreshCw, GitPullRequest, CircleDot } from "lucide-react";
import type { PullRequestSummary } from "@rd-git/shared";

type FilterMode = "all" | "ready" | "draft";

interface PullRequestListProps {
  pullRequests: PullRequestSummary[];
  isLoading: boolean;
  error: string | undefined;
  selectedPrNumber: number | undefined;
  onSelect: (prNumber: number) => void;
  onRefresh: () => void;
}

function PullRequestList({
  pullRequests,
  isLoading,
  error,
  selectedPrNumber,
  onSelect,
  onRefresh,
}: PullRequestListProps) {
  const [filter, setFilter] = useState<FilterMode>("all");

  const filtered = pullRequests.filter((pr) => {
    if (filter === "ready") {
      return !pr.isDraft;
    }
    if (filter === "draft") {
      return pr.isDraft;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border-muted flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">Pull Requests</span>
          <span className="text-xs text-text-subtle">({filtered.length})</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="text-text-subtle hover:text-text-muted transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="px-4 py-2 border-b border-border-muted flex gap-1">
        {(["all", "ready", "draft"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilter(mode)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              filter === mode
                ? "bg-accent-emphasis text-white"
                : "text-text-muted hover:text-text hover:bg-surface-raised"
            }`}
          >
            {mode === "all" ? "All" : mode === "ready" ? "Ready" : "Draft"}
          </button>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filtered.map((pr) => (
          <button
            key={pr.id}
            type="button"
            onClick={() => onSelect(pr.id)}
            className={`w-full text-left px-4 py-3 border-b border-border-muted transition-colors ${
              selectedPrNumber === pr.id
                ? "bg-surface-raised"
                : "hover:bg-surface-raised/50"
            }`}
          >
            <div className="flex items-start gap-2">
              {pr.isDraft ? (
                <CircleDot size={14} className="text-text-subtle mt-0.5 flex-shrink-0" />
              ) : (
                <GitPullRequest size={14} className="text-success mt-0.5 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-sm text-text truncate">{pr.title}</div>
                <div className="text-xs text-text-subtle mt-0.5">
                  #{pr.id} · {pr.branchName}
                </div>
                <div className="text-xs text-text-subtle mt-0.5">
                  {formatRelativeTime(pr.updatedAtIso)}
                  {pr.assigneeLogins.length > 0 && (
                    <> · {pr.assigneeLogins.join(", ")}</>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && !isLoading && !error && (
          <div className="px-4 py-8 text-center text-text-subtle text-sm">
            No pull requests found
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(isoDate).getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "just now";
  }
  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}m ago`;
  }
  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h ago`;
  }
  return `${Math.floor(diffMs / day)}d ago`;
}

export { PullRequestList };
