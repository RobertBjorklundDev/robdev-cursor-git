import { useState, useEffect, useCallback } from "react";
import {
  GitHubClient,
  getPullRequestDetail,
  getPullRequestComments,
  getPullRequestReviews,
  getPullRequestReviewComments,
  resolveLinkedIssues,
  getIssueDetail,
  getFilteredIssueTimeline,
  DEFAULT_LINKING_CONFIG,
} from "@rd-git/shared";
import type {
  GitHubRepository,
  PullRequestDetail,
  IssueDetail,
  TimelineComment,
  ReviewThread,
  ReviewSummary,
} from "@rd-git/shared";
import {
  GitPullRequest,
  CircleDot,
  CheckCircle2,
  XCircle,
  MessageSquare,
  FileCode,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface PullRequestDetailViewProps {
  repo: GitHubRepository;
  pullNumber: number;
  accessToken: string;
}

interface DetailState {
  pr: PullRequestDetail | undefined;
  issue: IssueDetail | undefined;
  prComments: TimelineComment[];
  issueComments: TimelineComment[];
  reviews: ReviewSummary[];
  reviewThreads: ReviewThread[];
  isLoading: boolean;
  error: string | undefined;
}

function PullRequestDetailView({ repo, pullNumber, accessToken }: PullRequestDetailViewProps) {
  const [state, setState] = useState<DetailState>({
    pr: undefined,
    issue: undefined,
    prComments: [],
    issueComments: [],
    reviews: [],
    reviewThreads: [],
    isLoading: true,
    error: undefined,
  });

  const [activeTab, setActiveTab] = useState<"comments" | "reviews" | "issue">("comments");

  const loadDetails = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: undefined }));
    try {
      const client = new GitHubClient({ accessToken });
      const pr = await getPullRequestDetail(client, repo, pullNumber);
      const [prComments, reviews, reviewThreads] = await Promise.all([
        getPullRequestComments(client, repo, pullNumber),
        getPullRequestReviews(client, repo, pullNumber),
        getPullRequestReviewComments(client, repo, pullNumber),
      ]);

      let issue: IssueDetail | undefined;
      let issueComments: TimelineComment[] = [];
      try {
        const linkedIssues = await resolveLinkedIssues(
          client, repo, pullNumber, pr.branchName, pr.body, DEFAULT_LINKING_CONFIG,
        );
        if (linkedIssues.length > 0) {
          const issueNumber = linkedIssues[0].issueNumber;
          issue = await getIssueDetail(client, repo, issueNumber);
          issueComments = await getFilteredIssueTimeline(client, repo, issueNumber);
        }
      } catch {
        // Linked issue resolution is best-effort
      }

      setState({
        pr,
        issue,
        prComments: filterBotComments(prComments),
        issueComments: filterBotComments(issueComments),
        reviews,
        reviewThreads,
        isLoading: false,
        error: undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load details.";
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, [accessToken, repo, pullNumber]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const { pr, issue, prComments, issueComments, reviews, reviewThreads, isLoading, error } = state;

  if (isLoading && !pr) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        Loading PR #{pullNumber}...
      </div>
    );
  }

  if (error && !pr) {
    return (
      <div className="flex items-center justify-center h-full text-danger">{error}</div>
    );
  }

  if (!pr) {
    return null;
  }

  const allComments = [...prComments, ...issueComments].sort(
    (a, b) => new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime(),
  );

  const latestReviewByAuthor = getLatestReviewByAuthor(reviews);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {pr.isDraft ? (
              <CircleDot size={18} className="text-text-subtle" />
            ) : (
              <GitPullRequest size={18} className="text-success" />
            )}
            <h2 className="text-lg font-semibold text-text">{pr.title}</h2>
          </div>
          <div className="text-sm text-text-muted">
            #{pr.id} · {pr.branchName} → {pr.baseBranchName} · by {pr.authorLogin}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadDetails()}
            disabled={isLoading}
            className="text-text-subtle hover:text-text-muted transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline text-sm flex items-center gap-1"
          >
            Open on GitHub <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        <StatusBadge label={pr.isDraft ? "Draft" : "Ready"} variant={pr.isDraft ? "muted" : "success"} />
        {pr.mergeable !== undefined && (
          <StatusBadge
            label={pr.mergeable ? "Mergeable" : "Conflicts"}
            variant={pr.mergeable ? "success" : "danger"}
          />
        )}
        {latestReviewByAuthor.map(([author, review]) => (
          <ReviewBadge key={author} author={author} state={review.state} />
        ))}
        {issue && (
          <StatusBadge label={`Issue #${issue.number}: ${issue.state}`} variant={issue.state === "open" ? "info" : "muted"} />
        )}
      </div>

      {/* Linked issue summary */}
      {issue && (
        <div className="bg-surface rounded-lg border border-border p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-text">
              Linked Issue #{issue.number}
            </h3>
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline text-xs flex items-center gap-1"
            >
              Open <ExternalLink size={10} />
            </a>
          </div>
          <div className="text-sm text-text-muted mb-1">{issue.title}</div>
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((label) => (
              <span
                key={label}
                className="text-xs bg-surface-raised border border-border-muted rounded px-2 py-0.5 text-text-muted"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border mb-4 flex gap-0">
        {([
          { id: "comments" as const, label: "Comments", count: allComments.length, icon: MessageSquare },
          { id: "reviews" as const, label: "Reviews", count: reviewThreads.length, icon: FileCode },
          ...(issue ? [{ id: "issue" as const, label: "Issue Timeline", count: issueComments.length, icon: MessageSquare }] : []),
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-accent text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            <span className="text-xs text-text-subtle">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "comments" && (
        <CommentsList comments={allComments} emptyMessage="No comments yet" />
      )}
      {activeTab === "reviews" && (
        <ReviewThreadsList threads={reviewThreads} />
      )}
      {activeTab === "issue" && (
        <CommentsList comments={issueComments} emptyMessage="No issue comments" />
      )}
    </div>
  );
}

function CommentsList({ comments, emptyMessage }: { comments: TimelineComment[]; emptyMessage: string }) {
  if (comments.length === 0) {
    return <div className="text-text-subtle text-sm py-4">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <div key={`${comment.source}-${comment.id}`} className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text">{comment.authorLogin}</span>
              <span className="text-xs text-text-subtle">
                {formatDateTime(comment.createdAtIso)}
              </span>
              {comment.source !== "pr" && (
                <span className="text-xs bg-surface-raised border border-border-muted rounded px-1.5 py-0.5 text-text-subtle">
                  {comment.source}
                </span>
              )}
            </div>
            {comment.url && (
              <a
                href={comment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline text-xs"
              >
                <ExternalLink size={10} />
              </a>
            )}
          </div>
          <div className="text-sm text-text-muted whitespace-pre-wrap">{comment.body}</div>
        </div>
      ))}
    </div>
  );
}

function ReviewThreadsList({ threads }: { threads: ReviewThread[] }) {
  if (threads.length === 0) {
    return <div className="text-text-subtle text-sm py-4">No review threads</div>;
  }

  return (
    <div className="space-y-4">
      {threads.map((thread) => (
        <div key={thread.id} className="bg-surface rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-2 bg-surface-raised border-b border-border-muted flex items-center justify-between">
            <div className="text-xs font-mono text-text-muted">
              {thread.path}
              {thread.line !== undefined && <span className="text-text-subtle">:{thread.line}</span>}
            </div>
            {thread.isResolved && (
              <span className="text-xs text-success flex items-center gap-1">
                <CheckCircle2 size={10} /> Resolved
              </span>
            )}
          </div>
          <div className="divide-y divide-border-muted">
            {thread.comments.map((comment) => (
              <div key={comment.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-text">{comment.authorLogin}</span>
                  <span className="text-xs text-text-subtle">{formatDateTime(comment.createdAtIso)}</span>
                </div>
                <div className="text-sm text-text-muted whitespace-pre-wrap">{comment.body}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ label, variant }: { label: string; variant: "success" | "danger" | "warning" | "info" | "muted" }) {
  const colorMap = {
    success: "text-success border-success/30",
    danger: "text-danger border-danger/30",
    warning: "text-warning border-warning/30",
    info: "text-info border-info/30",
    muted: "text-text-subtle border-border-muted",
  };

  return (
    <span className={`text-xs border rounded-full px-2.5 py-0.5 ${colorMap[variant]}`}>
      {label}
    </span>
  );
}

function ReviewBadge({ author, state }: { author: string; state: ReviewSummary["state"] }) {
  const stateConfig: Record<ReviewSummary["state"], { icon: typeof CheckCircle2; color: string }> = {
    APPROVED: { icon: CheckCircle2, color: "text-success" },
    CHANGES_REQUESTED: { icon: XCircle, color: "text-danger" },
    COMMENTED: { icon: MessageSquare, color: "text-text-muted" },
    PENDING: { icon: CircleDot, color: "text-warning" },
    DISMISSED: { icon: XCircle, color: "text-text-subtle" },
  };

  const config = stateConfig[state] ?? stateConfig.COMMENTED;
  const Icon = config.icon;

  return (
    <span className={`text-xs border border-border-muted rounded-full px-2.5 py-0.5 flex items-center gap-1 ${config.color}`}>
      <Icon size={10} />
      {author}
    </span>
  );
}

function getLatestReviewByAuthor(reviews: ReviewSummary[]): Array<[string, ReviewSummary]> {
  const map = new Map<string, ReviewSummary>();
  for (const review of reviews) {
    const existing = map.get(review.authorLogin);
    if (!existing || new Date(review.submittedAtIso) > new Date(existing.submittedAtIso)) {
      map.set(review.authorLogin, review);
    }
  }
  return Array.from(map.entries());
}

function filterBotComments(comments: TimelineComment[]): TimelineComment[] {
  return comments.filter((c) => !c.authorLogin.endsWith("[bot]"));
}

function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (diffMs < day) {
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    if (hours < 1) {
      const minutes = Math.floor(diffMs / (60 * 1000));
      return minutes <= 1 ? "just now" : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  }
  if (diffMs < 7 * day) {
    return `${Math.floor(diffMs / day)}d ago`;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export { PullRequestDetailView };
