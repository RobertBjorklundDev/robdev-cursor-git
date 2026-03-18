import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import { GitHubClient, listOpenPullRequests, parseGitHubRemoteUrl } from "@rd-git/shared";
import type { PullRequestSummary, GitHubRepository } from "@rd-git/shared";
import { PullRequestList } from "./PullRequestList";
import { PullRequestDetailView } from "./PullRequestDetailView";

function Dashboard() {
  const { accessToken, login, signOut } = useAuth();
  const [repoInput, setRepoInput] = useState(() => localStorage.getItem("rd-git-repo") ?? "");
  const [repo, setRepo] = useState<GitHubRepository | undefined>(() => {
    const stored = localStorage.getItem("rd-git-repo");
    if (stored) {
      return parseRepoInput(stored);
    }
    return undefined;
  });
  const [pullRequests, setPullRequests] = useState<PullRequestSummary[]>([]);
  const [selectedPrNumber, setSelectedPrNumber] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const loadPullRequests = useCallback(async () => {
    if (!accessToken || !repo) {
      return;
    }
    setIsLoading(true);
    setError(undefined);
    try {
      const client = new GitHubClient({ accessToken });
      const prs = await listOpenPullRequests(client, repo, {
        perPage: 30,
        viewerLogin: login,
      });
      setPullRequests(prs);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load pull requests.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, repo, login]);

  useEffect(() => {
    void loadPullRequests();
  }, [loadPullRequests]);

  function handleSetRepo() {
    const parsed = parseRepoInput(repoInput);
    if (parsed) {
      localStorage.setItem("rd-git-repo", repoInput);
      setRepo(parsed);
      setSelectedPrNumber(undefined);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-semibold text-text">RDgit</h1>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { handleSetRepo(); } }}
              placeholder="owner/repo or GitHub URL"
              className="bg-surface-raised border border-border-muted rounded px-3 py-1.5 text-sm text-text placeholder:text-text-subtle w-72 focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={handleSetRepo}
              className="bg-accent-emphasis text-white text-sm px-3 py-1.5 rounded hover:opacity-90 transition-opacity"
            >
              Load
            </button>
          </div>
          {repo && (
            <span className="text-text-muted text-sm">
              {repo.owner}/{repo.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {login && <span className="text-text-muted text-sm">{login}</span>}
          <button
            type="button"
            onClick={signOut}
            className="text-text-subtle text-sm hover:text-text-muted transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r border-border bg-surface overflow-y-auto flex-shrink-0">
          <PullRequestList
            pullRequests={pullRequests}
            isLoading={isLoading}
            error={error}
            selectedPrNumber={selectedPrNumber}
            onSelect={setSelectedPrNumber}
            onRefresh={() => void loadPullRequests()}
          />
        </aside>
        <main className="flex-1 overflow-y-auto">
          {selectedPrNumber && repo && accessToken ? (
            <PullRequestDetailView
              repo={repo}
              pullNumber={selectedPrNumber}
              accessToken={accessToken}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-subtle">
              {repo ? "Select a pull request to view details" : "Enter a repository to get started"}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function parseRepoInput(input: string): GitHubRepository | undefined {
  const trimmed = input.trim();
  const urlParsed = parseGitHubRemoteUrl(trimmed);
  if (urlParsed) {
    return urlParsed;
  }
  const slashMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slashMatch) {
    return { owner: slashMatch[1], name: slashMatch[2] };
  }
  return undefined;
}

export { Dashboard };
