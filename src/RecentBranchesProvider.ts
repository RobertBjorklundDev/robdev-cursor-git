import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Repository } from "./types";

const MAX_STORED_BRANCHES = 20;
const MAX_VISIBLE_BRANCHES = 5;
interface RecentBranch {
  name: string;
  isCurrent: boolean;
  lastCommitDescription: string;
}
type ExecFileAsync = (
  file: string,
  args: string[],
  options: { cwd: string }
) => Promise<{ stdout: string; stderr: string }>;

class BranchItem extends vscode.TreeItem {
  public readonly branchName: string;

  public constructor(branchName: string, isCurrent: boolean, lastCommitDescription: string) {
    super(branchName, vscode.TreeItemCollapsibleState.None);
    this.branchName = branchName;
    this.command = {
      command: "branchSwitcher.switchBranch",
      title: "Switch Branch",
      arguments: [branchName]
    };
    this.contextValue = "branchSwitcher.branchItem";
    this.description = isCurrent ? `current • ${lastCommitDescription}` : lastCommitDescription;
  }
}

class RecentBranchesProvider implements vscode.TreeDataProvider<BranchItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<BranchItem | undefined | void>();
  private readonly execFileAsync = promisify(execFile) as unknown as ExecFileAsync;
  private repository: Repository | undefined;

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private readonly state: vscode.Memento;

  public constructor(state: vscode.Memento) {
    this.state = state;
  }

  public setRepository(repository: Repository | undefined) {
    this.repository = repository;
    this.refresh();
  }

  public getRepository() {
    return this.repository;
  }

  public async updateMruBranch(branchName: string) {
    if (!this.repository) {
      return;
    }
    const normalizedBranchName = this.normalizeBranchName(branchName);

    const current = this.getMruForCurrentRepo();
    const deduped = current.filter((name) => name !== normalizedBranchName);
    const updated = [normalizedBranchName, ...deduped].slice(0, MAX_STORED_BRANCHES);
    await this.state.update(this.getStorageKey(this.repository.rootUri.fsPath), updated);
  }

  public refresh() {
    this.onDidChangeTreeDataEmitter.fire();
  }

  public getTreeItem(element: BranchItem) {
    return element;
  }

  public async getChildren() {
    const branches = await this.getRecentBranches();
    return branches.map(
      (branch) => new BranchItem(branch.name, branch.isCurrent, branch.lastCommitDescription)
    );
  }

  public async getRecentBranches() {
    if (!this.repository) {
      return [];
    }

    const mru = this.getMruForCurrentRepo();
    const filtered = [...mru].sort((a, b) => a.localeCompare(b)).slice(0, MAX_VISIBLE_BRANCHES);
    const headName = this.normalizeBranchName(this.repository.state.HEAD?.name ?? "");
    const items = await Promise.all(
      filtered.map(async (name) => {
        const description = await this.getLastCommitDescription(name);
        return {
          name,
          isCurrent: name === headName,
          lastCommitDescription: description
        };
      })
    );
    return items;
  }

  private getStorageKey(repoPath: string) {
    return `branchSwitcher.mru.${repoPath}`;
  }

  private getMruForCurrentRepo() {
    if (!this.repository) {
      return [];
    }

    const raw = this.state.get<string[]>(this.getStorageKey(this.repository.rootUri.fsPath), []);
    const normalized = raw.map((name) => this.normalizeBranchName(name));
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const name of normalized) {
      if (!name || seen.has(name)) {
        continue;
      }
      seen.add(name);
      unique.push(name);
    }

    return unique;
  }

  private normalizeBranchName(branchName: string) {
    if (branchName.startsWith("refs/heads/")) {
      return branchName.slice("refs/heads/".length);
    }

    if (branchName.startsWith("heads/")) {
      return branchName.slice("heads/".length);
    }

    return branchName;
  }

  private async getLastCommitDescription(branchName: string) {
    if (!this.repository) {
      return "no commits";
    }

    try {
      const { stdout } = await this.execFileAsync(
        "git",
        ["log", "-1", "--format=%ct", branchName],
        { cwd: this.repository.rootUri.fsPath }
      );
      const timestampSeconds = Number(stdout.trim());
      if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
        return "no commits";
      }
      return this.formatRelativeTime(timestampSeconds * 1000);
    } catch {
      return "no commits";
    }
  }

  private formatRelativeTime(timestampMs: number) {
    const diffMs = Math.max(0, Date.now() - timestampMs);
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) {
      return "last commit now";
    }
    if (diffMs < hour) {
      const minutes = Math.floor(diffMs / minute);
      return `last commit ${minutes}m ago`;
    }
    if (diffMs < day) {
      const hours = Math.floor(diffMs / hour);
      return `last commit ${hours}h ago`;
    }

    const days = Math.floor(diffMs / day);
    return `last commit ${days}d ago`;
  }
}

export { RecentBranchesProvider };
export type { RecentBranch };
