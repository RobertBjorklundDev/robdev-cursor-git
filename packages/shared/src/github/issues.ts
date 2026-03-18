import type { GitHubClient } from "./client";
import type { GitHubRepository, IssueDetail, TimelineComment } from "../types";

interface GitHubIssueItem {
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  state: string;
  user: { login: string } | null;
  assignees: Array<{ login: string }>;
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
}

interface GitHubIssueCommentItem {
  id: number;
  user: { login: string } | null;
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface GitHubTimelineEvent {
  event: string;
  id?: number;
  actor?: { login: string } | null;
  body?: string;
  created_at?: string;
  updated_at?: string;
  html_url?: string;
}

const HUMAN_COMMENT_EVENTS = new Set(["commented"]);

const NOISE_EVENTS = new Set([
  "labeled",
  "unlabeled",
  "assigned",
  "unassigned",
  "moved_columns_in_project",
  "added_to_project",
  "removed_from_project",
  "converted_note_to_issue",
  "subscribed",
  "unsubscribed",
  "mentioned",
  "automatic_base_change_succeeded",
  "automatic_base_change_failed",
  "base_ref_changed",
  "deployed",
  "deployment_environment_changed",
  "head_ref_restored",
  "transferred",
  "connected",
  "disconnected",
]);

async function getIssueDetail(
  client: GitHubClient,
  repo: GitHubRepository,
  issueNumber: number,
): Promise<IssueDetail> {
  const item = await client.get<GitHubIssueItem>(
    `/repos/${repo.owner}/${repo.name}/issues/${issueNumber}`,
  );
  return {
    number: item.number,
    title: item.title,
    url: item.html_url,
    body: item.body ?? "",
    state: item.state,
    authorLogin: item.user?.login ?? "unknown",
    assigneeLogins: item.assignees.map((a) => a.login),
    labels: item.labels.map((l) => l.name),
    createdAtIso: item.created_at,
    updatedAtIso: item.updated_at,
  };
}

async function getIssueComments(
  client: GitHubClient,
  repo: GitHubRepository,
  issueNumber: number,
): Promise<TimelineComment[]> {
  const items = await client.get<GitHubIssueCommentItem[]>(
    `/repos/${repo.owner}/${repo.name}/issues/${issueNumber}/comments?per_page=100`,
  );
  return items.map((item) => ({
    id: item.id,
    authorLogin: item.user?.login ?? "unknown",
    body: item.body,
    createdAtIso: item.created_at,
    updatedAtIso: item.updated_at,
    url: item.html_url,
    source: "issue" as const,
  }));
}

async function getFilteredIssueTimeline(
  client: GitHubClient,
  repo: GitHubRepository,
  issueNumber: number,
  options?: { excludeEvents?: Set<string>; includeBotComments?: boolean },
): Promise<TimelineComment[]> {
  const excludeEvents = options?.excludeEvents ?? NOISE_EVENTS;
  const includeBots = options?.includeBotComments ?? false;

  const events = await client.get<GitHubTimelineEvent[]>(
    `/repos/${repo.owner}/${repo.name}/issues/${issueNumber}/timeline?per_page=100`,
  );

  const comments: TimelineComment[] = [];
  for (const event of events) {
    if (excludeEvents.has(event.event)) {
      continue;
    }
    if (!HUMAN_COMMENT_EVENTS.has(event.event)) {
      continue;
    }
    if (!event.body || !event.actor?.login) {
      continue;
    }
    if (!includeBots && event.actor.login.endsWith("[bot]")) {
      continue;
    }
    comments.push({
      id: event.id ?? 0,
      authorLogin: event.actor.login,
      body: event.body,
      createdAtIso: event.created_at ?? "",
      updatedAtIso: event.updated_at ?? event.created_at ?? "",
      url: event.html_url ?? "",
      source: "issue",
    });
  }
  return comments;
}

export {
  getFilteredIssueTimeline,
  getIssueComments,
  getIssueDetail,
  HUMAN_COMMENT_EVENTS,
  NOISE_EVENTS,
};
