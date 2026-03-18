const GITHUB_API_URL = "https://api.github.com";

interface GitHubClientOptions {
  accessToken: string;
  userAgent?: string;
}

class GitHubClient {
  private readonly accessToken: string;
  private readonly userAgent: string;

  constructor(options: GitHubClientOptions) {
    this.accessToken = options.accessToken;
    this.userAgent = options.userAgent ?? "rd-git";
  }

  async get<T>(path: string): Promise<T> {
    const url = `${GITHUB_API_URL}${path}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new GitHubApiError(response.status, message, url);
    }
    return (await response.json()) as T;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const url = `${GITHUB_API_URL}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new GitHubApiError(response.status, message, url);
    }
    return (await response.json()) as T;
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const url = `${GITHUB_API_URL}${path}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: this.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new GitHubApiError(response.status, message, url);
    }
    return (await response.json()) as T;
  }

  async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const url = `${GITHUB_API_URL}/graphql`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new GitHubApiError(response.status, message, url);
    }
    const payload = (await response.json()) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };
    if (payload.errors && payload.errors.length > 0) {
      const firstMessage = payload.errors[0]?.message ?? "GraphQL request failed.";
      throw new GitHubApiError(200, firstMessage, url);
    }
    if (!payload.data) {
      throw new GitHubApiError(200, "GraphQL response missing data.", url);
    }
    return payload.data;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": this.userAgent,
    };
  }
}

class GitHubApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, message: string, url: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.url = url;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `GitHub returned ${response.status}.`;
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? fallback;
  } catch {
    return fallback;
  }
}

export { GitHubClient, GitHubApiError, GITHUB_API_URL };
