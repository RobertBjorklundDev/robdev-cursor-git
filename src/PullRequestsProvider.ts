import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LogStore } from "./LogStore";
import type { Repository } from "./types";

const MAX_VISIBLE_PULL_REQUESTS = 10;
const GITHUB_API_URL = "https://api.github.com";
const GITHUB_SCOPES = ["read:user", "repo"];

interface PullRequestSummary {
  id: number;
  title: string;
  url: string;
  branchName: string;
  isDraft: boolean;
  state: string;
  mergeable: boolean | undefined;
  mergeableState: string | undefined;
}

interface GitHubAuthStatus {
  isProviderAvailable: boolean;
  isAuthenticated: boolean;
}

interface GitHubPullRequestListItem {
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft: boolean;
  head: {
    ref: string;
  };
}

interface GitHubPullRequestDetailItem {
  mergeable: boolean | null;
  mergeable_state: string;
}

interface GitHubRepository {
  owner: string;
  name: string;
}

type ExecFileAsync = (
  file: string,
  args: string[],
  options: { cwd: string }
) => Promise<{ stdout: string; stderr: string }>;

class PullRequestsProvider {
  private readonly execFileAsync = promisify(execFile) as unknown as ExecFileAsync;
  private readonly onDidChangeDataEmitter = new vscode.EventEmitter<void>();
  private repository: Repository | undefined;
  private readonly logStore: LogStore;

  public readonly onDidChangeData = this.onDidChangeDataEmitter.event;

  public constructor(logStore: LogStore) {
    this.logStore = logStore;
  }

  public setRepository(repository: Repository | undefined) {
    this.repository = repository;
    this.refresh();
  }

  public refresh() {
    this.onDidChangeDataEmitter.fire();
  }

  public async getPullRequests() {
    if (!this.repository) {
      this.logStore.warn("pull-requests", "No repository selected; skipping pull request fetch.");
      return [];
    }

    try {
      const session = await this.getGitHubSession();
      if (!session) {
        this.logStore.warn("pull-requests", "No GitHub auth session found.");
        return [];
      }

      const targetRepository = await this.resolveGitHubRepository(this.repository);
      if (!targetRepository) {
        this.logStore.warn("pull-requests", "Could not parse GitHub repository from origin remote.");
        return [];
      }

      this.logStore.info(
        "pull-requests",
        `Fetching open pull requests for ${targetRepository.owner}/${targetRepository.name}.`
      );
      const listItems = await this.fetchOpenPullRequests(targetRepository, session.accessToken);
      const details = await this.fetchMergeabilityDetails(
        targetRepository,
        listItems.map((item) => item.number),
        session.accessToken
      );
      this.logStore.info("pull-requests", `Loaded ${listItems.length} open pull requests.`);

      return listItems.map((item) => {
        const detail = details.get(item.number);
        return {
          id: item.number,
          title: item.title,
          url: item.html_url,
          branchName: item.head.ref,
          isDraft: item.draft,
          state: item.state,
          mergeable: detail?.mergeable,
          mergeableState: detail?.mergeableState
        };
      });
    } catch {
      this.logStore.error("pull-requests", "Failed to fetch pull requests.");
      return [];
    }
  }

  public async getAuthStatus() {
    const isProviderAvailable = await this.isGitHubProviderAvailable();
    if (!isProviderAvailable) {
      return {
        isProviderAvailable: false,
        isAuthenticated: false
      };
    }

    const session = await this.getGitHubSession();
    return {
      isProviderAvailable: true,
      isAuthenticated: !!session
    };
  }

  public async signIn() {
    const session = await this.ensureGitHubSession({ createIfNone: true });
    if (session) {
      this.logStore.info("auth", "GitHub sign-in completed.");
      return true;
    }
    this.logStore.warn("auth", "GitHub sign-in did not return a session.");
    return false;
  }

  public async switchAccount() {
    const session = await this.ensureGitHubSession({
      createIfNone: true,
      forceNewSession: true
    });
    if (session) {
      this.logStore.info("auth", "GitHub account switch completed.");
      return true;
    }
    this.logStore.warn("auth", "GitHub account switch did not return a session.");
    return false;
  }

  public async openGitHubAccountsMenu() {
    try {
      await vscode.commands.executeCommand("workbench.action.showAccounts");
      this.logStore.info("auth", "Opened Accounts menu.");
    } catch {
      this.logStore.warn("auth", "Could not open Accounts menu.");
    }
  }

  public async mergePullRequest(pullRequestId: number) {
    if (!this.repository) {
      this.logStore.error("pull-requests", "Merge requested without an active repository.");
      return {
        ok: false,
        message: "No Git repository is available."
      };
    }

    try {
      const session = await this.getGitHubSession();
      if (!session) {
        this.logStore.error("pull-requests", "Merge requested without GitHub auth session.");
        return {
          ok: false,
          message: "GitHub authentication is required."
        };
      }

      const targetRepository = await this.resolveGitHubRepository(this.repository);
      if (!targetRepository) {
        this.logStore.error("pull-requests", "Merge requested but origin remote is not a supported GitHub URL.");
        return {
          ok: false,
          message: "Could not determine GitHub repository from origin remote."
        };
      }

      this.logStore.info("pull-requests", `PUT /repos/${targetRepository.owner}/${targetRepository.name}/pulls/${pullRequestId}/merge`);
      const response = await fetch(
        `${GITHUB_API_URL}/repos/${targetRepository.owner}/${targetRepository.name}/pulls/${pullRequestId}/merge`,
        {
          method: "PUT",
          headers: this.getGitHubHeaders(session.accessToken),
          body: JSON.stringify({ merge_method: "merge" })
        }
      );

      if (!response.ok) {
        const fallbackMessage = `GitHub returned ${response.status}.`;
        const message = await this.readErrorMessage(response, fallbackMessage);
        this.logStore.error("pull-requests", `Merge failed for PR #${pullRequestId}: ${message}`);
        return {
          ok: false,
          message
        };
      }

      this.logStore.info("pull-requests", `Merge successful for PR #${pullRequestId}.`);
      return {
        ok: true,
        message: `Merged PR #${pullRequestId}.`
      };
    } catch {
      this.logStore.error("pull-requests", `Unexpected merge failure for PR #${pullRequestId}.`);
      return {
        ok: false,
        message: "Failed to merge pull request."
      };
    }
  }

  private async getGitHubSession() {
    return this.ensureGitHubSession({ createIfNone: false });
  }

  private async ensureGitHubSession(options: { createIfNone: boolean; forceNewSession?: boolean }) {
    try {
      const session = await vscode.authentication.getSession("github", GITHUB_SCOPES, {
        createIfNone: options.createIfNone,
        forceNewSession: options.forceNewSession
      });
      if (session) {
        this.logStore.info("auth", "GitHub auth session found.");
      }
      return session;
    } catch {
      this.logStore.error("auth", "Failed to resolve GitHub auth session.");
      return undefined;
    }
  }

  private async isGitHubProviderAvailable() {
    try {
      await vscode.authentication.getAccounts("github");
      return true;
    } catch {
      return false;
    }
  }

  private async resolveGitHubRepository(repository: Repository) {
    try {
      const stdout = await this.runGitCommand(repository, ["remote", "get-url", "origin"]);
      const remoteUrl = stdout.trim();
      this.logStore.info("git", `origin remote: ${remoteUrl}`);
      return this.parseGitHubRemoteUrl(remoteUrl);
    } catch {
      this.logStore.error("git", "Failed to read origin remote URL.");
      return undefined;
    }
  }

  private parseGitHubRemoteUrl(remoteUrl: string) {
    const httpsMatch = remoteUrl.match(
      /^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/.]+?)(?:\.git)?$/i
    );
    if (httpsMatch?.groups) {
      return {
        owner: httpsMatch.groups.owner,
        name: httpsMatch.groups.repo
      };
    }

    const sshMatch = remoteUrl.match(/^git@github\.com:(?<owner>[^/]+)\/(?<repo>[^/.]+?)(?:\.git)?$/i);
    if (sshMatch?.groups) {
      return {
        owner: sshMatch.groups.owner,
        name: sshMatch.groups.repo
      };
    }

    return undefined;
  }

  private async fetchOpenPullRequests(repository: GitHubRepository, accessToken: string) {
    const endpoint = `${GITHUB_API_URL}/repos/${repository.owner}/${repository.name}/pulls?state=open&sort=updated&direction=desc&per_page=${MAX_VISIBLE_PULL_REQUESTS}`;
    this.logStore.info("github-api", `GET ${endpoint}`);
    const response = await fetch(
      endpoint,
      {
        headers: this.getGitHubHeaders(accessToken)
      }
    );
    this.logStore.info("github-api", `Response ${response.status} for open pull requests list.`);

    if (!response.ok) {
      const message = await this.readErrorMessage(response, `GitHub returned ${response.status}.`);
      this.logStore.error("github-api", message);
      throw new Error(message);
    }

    const payload = (await response.json()) as GitHubPullRequestListItem[];
    return payload;
  }

  private async fetchMergeabilityDetails(
    repository: GitHubRepository,
    pullRequestIds: number[],
    accessToken: string
  ) {
    const details = new Map<number, { mergeable: boolean | undefined; mergeableState: string | undefined }>();

    await Promise.all(
      pullRequestIds.map(async (pullRequestId) => {
        try {
          const endpoint = `${GITHUB_API_URL}/repos/${repository.owner}/${repository.name}/pulls/${pullRequestId}`;
          this.logStore.info("github-api", `GET ${endpoint}`);
          const response = await fetch(
            endpoint,
            {
              headers: this.getGitHubHeaders(accessToken)
            }
          );
          this.logStore.info("github-api", `Response ${response.status} for PR #${pullRequestId} detail.`);
          if (!response.ok) {
            const message = await this.readErrorMessage(
              response,
              `GitHub returned ${response.status} for PR #${pullRequestId}.`
            );
            this.logStore.warn("github-api", message);
            return;
          }
          const payload = (await response.json()) as GitHubPullRequestDetailItem;
          details.set(pullRequestId, {
            mergeable: payload.mergeable === null ? undefined : payload.mergeable,
            mergeableState: payload.mergeable_state
          });
        } catch {
          this.logStore.warn("github-api", `Failed to fetch details for PR #${pullRequestId}.`);
          return;
        }
      })
    );

    return details;
  }

  private getGitHubHeaders(accessToken: string) {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "cursor-branch-switcher"
    };
  }

  private async readErrorMessage(response: Response, fallbackMessage: string) {
    try {
      const payload = (await response.json()) as { message?: string };
      return payload.message ?? fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }

  private async runGitCommand(repository: Repository, args: string[]) {
    const commandString = `git ${args.join(" ")}`;
    this.logStore.info("git", `$ ${commandString}`);
    try {
      const { stdout, stderr } = await this.execFileAsync("git", args, {
        cwd: repository.rootUri.fsPath
      });
      const trimmedStdout = stdout.trim();
      const trimmedStderr = stderr.trim();
      if (trimmedStdout) {
        this.logStore.info("git", trimmedStdout);
      }
      if (trimmedStderr) {
        this.logStore.warn("git", trimmedStderr);
      }
      return stdout;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown git command error";
      this.logStore.error("git", message);
      throw error;
    }
  }
}

export { PullRequestsProvider };
export type { PullRequestSummary, GitHubAuthStatus };
