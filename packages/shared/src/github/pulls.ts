import type { GitHubClient } from "./client";
import type {
  GitHubRepository,
  PullRequestDetail,
  PullRequestSummary,
  ReviewSummary,
  ReviewThread,
  TimelineComment,
} from "../types";

interface GitHubPullRequestListItem {
  number: number;
  title: string;
  html_url: string;
  body: string;
  state: string;
  draft: boolean;
  created_at: string;
  updated_at: string;
  assignees: Array<{ login: string }>;
  user: { login: string } | null;
  head: { ref: string };
  base: { ref: string };
  node_id: string;
  mergeable: boolean | null;
  mergeable_state: string;
}

interface GitHubReviewItem {
  id: number;
  user: { login: string } | null;
  state: string;
  body: string;
  submitted_at: string;
  html_url: string;
}

interface GitHubCommentItem {
  id: number;
  user: { login: string } | null;
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface GitHubReviewCommentItem {
  id: number;
  user: { login: string } | null;
  body: string;
  path: string;
  line: number | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request_review_id: number;
  in_reply_to_id?: number;
}

const DEFAULT_PER_PAGE = 10;

async function listOpenPullRequests(
  client: GitHubClient,
  repo: GitHubRepository,
  options?: { perPage?: number; viewerLogin?: string },
): Promise<PullRequestSummary[]> {
  const perPage = options?.perPage ?? DEFAULT_PER_PAGE;
  const items = await client.get<GitHubPullRequestListItem[]>(
    `/repos/${repo.owner}/${repo.name}/pulls?state=open&sort=updated&direction=desc&per_page=${perPage}`,
  );

  return items.map((item) => {
    const assigneeLogins = item.assignees.map((a) => a.login);
    const isAssignedToViewer = options?.viewerLogin
      ? assigneeLogins.some((l) => l.toLowerCase() === options.viewerLogin!.toLowerCase())
      : false;
    return {
      id: item.number,
      title: item.title,
      url: item.html_url,
      branchName: item.head.ref,
      assigneeLogins,
      isAssignedToViewer,
      updatedAtIso: item.updated_at,
      isDraft: item.draft,
      state: item.state,
      mergeable: undefined,
      mergeableState: undefined,
    };
  });
}

async function getPullRequestDetail(
  client: GitHubClient,
  repo: GitHubRepository,
  pullNumber: number,
): Promise<PullRequestDetail> {
  const item = await client.get<GitHubPullRequestListItem>(
    `/repos/${repo.owner}/${repo.name}/pulls/${pullNumber}`,
  );
  return {
    id: item.number,
    nodeId: item.node_id,
    title: item.title,
    url: item.html_url,
    body: item.body ?? "",
    branchName: item.head.ref,
    baseBranchName: item.base.ref,
    authorLogin: item.user?.login ?? "unknown",
    assigneeLogins: item.assignees.map((a) => a.login),
    isDraft: item.draft,
    state: item.state,
    mergeable: item.mergeable === null ? undefined : item.mergeable,
    mergeableState: item.mergeable_state,
    createdAtIso: item.created_at,
    updatedAtIso: item.updated_at,
  };
}

async function getPullRequestMergeability(
  client: GitHubClient,
  repo: GitHubRepository,
  pullNumber: number,
): Promise<{ mergeable: boolean | undefined; mergeableState: string | undefined }> {
  const item = await client.get<GitHubPullRequestListItem>(
    `/repos/${repo.owner}/${repo.name}/pulls/${pullNumber}`,
  );
  return {
    mergeable: item.mergeable === null ? undefined : item.mergeable,
    mergeableState: item.mergeable_state,
  };
}

async function mergePullRequest(
  client: GitHubClient,
  repo: GitHubRepository,
  pullNumber: number,
  mergeMethod: "merge" | "squash" | "rebase" = "merge",
): Promise<void> {
  await client.put(
    `/repos/${repo.owner}/${repo.name}/pulls/${pullNumber}/merge`,
    { merge_method: mergeMethod },
  );
}

async function createDraftPullRequest(
  client: GitHubClient,
  repo: GitHubRepository,
  head: string,
  base: string,
  title?: string,
): Promise<{ number: number; url: string }> {
  const result = await client.post<{ number: number; html_url: string }>(
    `/repos/${repo.owner}/${repo.name}/pulls`,
    {
      title: title ?? `${head} -> ${base}`,
      head,
      base,
      draft: true,
    },
  );
  return { number: result.number, url: result.html_url };
}

async function markPullRequestReady(
  client: GitHubClient,
  repo: GitHubRepository,
  pullNumber: number,
): Promise<void> {
  await client.post(
    `/repos/${repo.owner}/${repo.name}/pulls/${pullNumber}/ready_for_review`,
  );
}

async function markPullRequestDraft(
  client: GitHubClient,
  nodeId: string,
): Promise<void> {
  await client.graphql(
    `mutation ConvertPullRequestToDraft($pullRequestId: ID!) {
      convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
        pullRequest { id }
      }
    }`,
    { pullRequestId: nodeId },
  );
}

async function getPullRequestComments(
  client: GitHubClient,
  repo: GitHubRepository,
  pullNumber: number,
): Promise<TimelineComment[]> {
  const items = await client.get<GitHubCommentItem[]>(
    `/repos/${repo.owner}/${repo.name}/issues/${pullNumber}/comments?per_page=100`,
  );
  return items.map((item) => ({
    id: item.id,
    authorLogin: item.user?.login ?? "unknown",
    body: item.body,
    createdAtIso: item.created_at,
    updatedAtIso: item.updated_at,
    url: item.html_url,
    source: "pr" as const,
  }));
}

async function getPullRequestReviews(
  client: GitHubClient,
  repo: GitHubRepository,
  pullNumber: number,
): Promise<ReviewSummary[]> {
  const items = await client.get<GitHubReviewItem[]>(
    `/repos/${repo.owner}/${repo.name}/pulls/${pullNumber}/reviews?per_page=100`,
  );
  return items.map((item) => ({
    authorLogin: item.user?.login ?? "unknown",
    state: item.state as ReviewSummary["state"],
    submittedAtIso: item.submitted_at,
  }));
}

async function getPullRequestReviewComments(
  client: GitHubClient,
  repo: GitHubRepository,
  pullNumber: number,
): Promise<ReviewThread[]> {
  const items = await client.get<GitHubReviewCommentItem[]>(
    `/repos/${repo.owner}/${repo.name}/pulls/${pullNumber}/comments?per_page=100`,
  );

  const threadsMap = new Map<number, ReviewThread>();
  for (const item of items) {
    const threadId = item.in_reply_to_id ?? item.id;
    const comment: TimelineComment = {
      id: item.id,
      authorLogin: item.user?.login ?? "unknown",
      body: item.body,
      createdAtIso: item.created_at,
      updatedAtIso: item.updated_at,
      url: item.html_url,
      source: "review",
    };

    const existing = threadsMap.get(threadId);
    if (existing) {
      existing.comments.push(comment);
    } else {
      threadsMap.set(threadId, {
        id: threadId,
        path: item.path,
        line: item.line ?? undefined,
        isResolved: false,
        comments: [comment],
      });
    }
  }

  return Array.from(threadsMap.values());
}

async function getViewerLogin(client: GitHubClient): Promise<string | undefined> {
  try {
    const user = await client.get<{ login?: string }>("/user");
    return typeof user.login === "string" ? user.login : undefined;
  } catch {
    return undefined;
  }
}

export {
  createDraftPullRequest,
  getPullRequestComments,
  getPullRequestDetail,
  getPullRequestMergeability,
  getPullRequestReviewComments,
  getPullRequestReviews,
  getViewerLogin,
  listOpenPullRequests,
  markPullRequestDraft,
  markPullRequestReady,
  mergePullRequest,
};
