import React from "react";
import { AlertTriangle, GitMerge, Pencil } from "lucide-react";
import type { PullRequestSummary } from "../../../shared/webview/contracts";

interface PullRequestStatusBadge {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

function getPullRequestStatus(pullRequest: PullRequestSummary) {
  const statusParts: string[] = [];
  if (pullRequest.isDraft) {
    statusParts.push("draft");
  } else {
    statusParts.push(pullRequest.state);
  }
  if (pullRequest.mergeableState) {
    statusParts.push(pullRequest.mergeableState);
  } else if (pullRequest.mergeable === true) {
    statusParts.push("mergeable");
  } else if (pullRequest.mergeable === false) {
    statusParts.push("conflicts");
  }
  return statusParts.join(" • ");
}

function getPullRequestBadge(pullRequest: PullRequestSummary): PullRequestStatusBadge {
  if (pullRequest.isDraft) {
    return {
      label: "draft",
      color: "var(--vscode-testing-iconQueued)",
      icon: Pencil
    };
  }

  if (pullRequest.mergeable === false || pullRequest.mergeableState === "dirty") {
    return {
      label: "conflicts",
      color: "var(--vscode-testing-iconFailed)",
      icon: AlertTriangle
    };
  }

  if (pullRequest.mergeable === true) {
    return {
      label: "mergeable",
      color: "var(--vscode-testing-iconPassed)",
      icon: GitMerge
    };
  }

  return {
    label: "open",
    color: "var(--vscode-descriptionForeground)",
    icon: GitMerge
  };
}

export { getPullRequestBadge, getPullRequestStatus };
