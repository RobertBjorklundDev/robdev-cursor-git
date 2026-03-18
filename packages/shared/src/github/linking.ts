import type { GitHubClient } from "./client";
import type { GitHubRepository } from "../types";

type LinkingStrategy =
  | "github-closing-refs"
  | "branch-pattern"
  | "pr-body-pattern"
  | "custom-regex";

interface LinkingConfig {
  strategy: LinkingStrategy;
  pattern?: string;
  issueTracker?: "github";
}

interface LinkedIssueRef {
  issueNumber: number;
  repo?: GitHubRepository;
}

const DEFAULT_LINKING_CONFIG: LinkingConfig = {
  strategy: "github-closing-refs",
  issueTracker: "github",
};

async function resolveLinkedIssues(
  client: GitHubClient,
  repo: GitHubRepository,
  pullNumber: number,
  branchName: string,
  prBody: string,
  config: LinkingConfig = DEFAULT_LINKING_CONFIG,
): Promise<LinkedIssueRef[]> {
  switch (config.strategy) {
    case "github-closing-refs":
      return resolveGitHubClosingRefs(client, repo, pullNumber);
    case "branch-pattern":
      return resolveBranchPattern(branchName, config.pattern);
    case "pr-body-pattern":
      return resolvePrBodyPattern(prBody, config.pattern);
    case "custom-regex":
      return resolveCustomRegex(branchName, prBody, config.pattern);
    default:
      return [];
  }
}

async function resolveGitHubClosingRefs(
  client: GitHubClient,
  repo: GitHubRepository,
  pullNumber: number,
): Promise<LinkedIssueRef[]> {
  try {
    const data = await client.graphql<{
      repository: {
        pullRequest: {
          closingIssuesReferences: {
            nodes: Array<{ number: number }>;
          };
        };
      };
    }>(
      `query ClosingIssues($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $number) {
            closingIssuesReferences(first: 10) {
              nodes { number }
            }
          }
        }
      }`,
      { owner: repo.owner, name: repo.name, number: pullNumber },
    );

    const nodes = data.repository.pullRequest.closingIssuesReferences.nodes;
    return nodes.map((node) => ({ issueNumber: node.number }));
  } catch {
    return [];
  }
}

function resolveBranchPattern(
  branchName: string,
  pattern?: string,
): LinkedIssueRef[] {
  const regex = pattern
    ? new RegExp(pattern)
    : /(?:^|\/)(\d+)(?:-|$)/;

  const match = branchName.match(regex);
  if (!match) {
    return [];
  }

  const captured = match[1];
  if (!captured) {
    return [];
  }

  const issueNumber = Number(captured);
  if (!Number.isFinite(issueNumber) || issueNumber <= 0) {
    return [];
  }

  return [{ issueNumber }];
}

function resolvePrBodyPattern(
  prBody: string,
  pattern?: string,
): LinkedIssueRef[] {
  const regex = pattern
    ? new RegExp(pattern, "gi")
    : /(?:closes|fixes|resolves)\s+#(\d+)/gi;

  const results: LinkedIssueRef[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prBody)) !== null) {
    const captured = match[1];
    if (!captured) {
      continue;
    }
    const issueNumber = Number(captured);
    if (Number.isFinite(issueNumber) && issueNumber > 0) {
      results.push({ issueNumber });
    }
  }
  return results;
}

function resolveCustomRegex(
  branchName: string,
  prBody: string,
  pattern?: string,
): LinkedIssueRef[] {
  if (!pattern) {
    return [];
  }

  const regex = new RegExp(pattern, "gi");
  const combined = `${branchName}\n${prBody}`;
  const results: LinkedIssueRef[] = [];
  const seen = new Set<number>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(combined)) !== null) {
    const captured = match[1];
    if (!captured) {
      continue;
    }
    const issueNumber = Number(captured);
    if (Number.isFinite(issueNumber) && issueNumber > 0 && !seen.has(issueNumber)) {
      seen.add(issueNumber);
      results.push({ issueNumber });
    }
  }
  return results;
}

function parseGitHubRemoteUrl(remoteUrl: string): GitHubRepository | undefined {
  const httpsMatch = remoteUrl.match(
    /^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/.]+?)(?:\.git)?$/i,
  );
  if (httpsMatch?.groups) {
    return { owner: httpsMatch.groups.owner, name: httpsMatch.groups.repo };
  }

  const sshMatch = remoteUrl.match(
    /^git@github\.com:(?<owner>[^/]+)\/(?<repo>[^/.]+?)(?:\.git)?$/i,
  );
  if (sshMatch?.groups) {
    return { owner: sshMatch.groups.owner, name: sshMatch.groups.repo };
  }

  return undefined;
}

export {
  DEFAULT_LINKING_CONFIG,
  parseGitHubRemoteUrl,
  resolveLinkedIssues,
};
export type { LinkingConfig, LinkingStrategy, LinkedIssueRef };
