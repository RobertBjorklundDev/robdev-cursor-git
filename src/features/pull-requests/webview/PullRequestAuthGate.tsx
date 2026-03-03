import React from "react";
import type { GitHubAuthStatus } from "../../../shared/webview/contracts";
import { Button, Card } from "../../../shared/webview/components";

interface PullRequestAuthGateProps {
  authStatus: GitHubAuthStatus;
  onOpenGithubAccounts(): void;
  onSignInGithub(): void;
  children: React.ReactNode;
}

function PullRequestAuthGate({
  authStatus,
  onOpenGithubAccounts,
  onSignInGithub,
  children
}: PullRequestAuthGateProps) {
  if (!authStatus.isProviderAvailable) {
    return (
      <Card className="px-3 py-2.5 text-muted-foreground" padding="none">
        <div className="mb-2">GitHub authentication provider is not available in this host.</div>
        <Button variant="secondary" onClick={onOpenGithubAccounts}>
          Open Accounts
        </Button>
      </Card>
    );
  }

  if (!authStatus.isAuthenticated) {
    return (
      <Card className="px-3 py-2.5 text-muted-foreground" padding="none">
        <div className="mb-2">Sign in to GitHub to load and merge pull requests.</div>
        <Button variant="secondary" onClick={onSignInGithub}>
          Sign in with GitHub
        </Button>
      </Card>
    );
  }

  return <>{children}</>;
}

export { PullRequestAuthGate };
