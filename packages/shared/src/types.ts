interface PullRequestSummary {
  id: number;
  title: string;
  url: string;
  branchName: string;
  assigneeLogins: string[];
  isAssignedToViewer: boolean;
  updatedAtIso: string;
  isDraft: boolean;
  state: string;
  mergeable: boolean | undefined;
  mergeableState: string | undefined;
}

interface GitHubAuthStatus {
  isProviderAvailable: boolean;
  isAuthenticated: boolean;
}

interface GitHubRepository {
  owner: string;
  name: string;
}

interface PullRequestDetail {
  id: number;
  nodeId: string;
  title: string;
  url: string;
  body: string;
  branchName: string;
  baseBranchName: string;
  authorLogin: string;
  assigneeLogins: string[];
  isDraft: boolean;
  state: string;
  mergeable: boolean | undefined;
  mergeableState: string | undefined;
  createdAtIso: string;
  updatedAtIso: string;
}

interface IssueDetail {
  number: number;
  title: string;
  url: string;
  body: string;
  state: string;
  authorLogin: string;
  assigneeLogins: string[];
  labels: string[];
  createdAtIso: string;
  updatedAtIso: string;
}

interface TimelineComment {
  id: number;
  authorLogin: string;
  body: string;
  createdAtIso: string;
  updatedAtIso: string;
  url: string;
  source: "issue" | "pr" | "review";
}

interface ReviewThread {
  id: number;
  path: string;
  line: number | undefined;
  isResolved: boolean;
  comments: TimelineComment[];
}

interface PullRequestWithContext {
  pullRequest: PullRequestDetail;
  linkedIssue: IssueDetail | undefined;
  comments: TimelineComment[];
  reviewThreads: ReviewThread[];
  reviews: ReviewSummary[];
}

interface ReviewSummary {
  authorLogin: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "PENDING" | "DISMISSED";
  submittedAtIso: string;
}

export type {
  GitHubAuthStatus,
  GitHubRepository,
  IssueDetail,
  PullRequestDetail,
  PullRequestSummary,
  PullRequestWithContext,
  ReviewSummary,
  ReviewThread,
  TimelineComment,
};
