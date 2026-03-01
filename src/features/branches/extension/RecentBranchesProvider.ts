import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LogStore } from "../../logs/extension";
import type { Repository } from "../../../shared/extension";
import type { RecentBranch } from "../../../shared/webview/contracts";

const MAX_STORED_BRANCHES = 20;
const MAX_VISIBLE_BRANCHES = 5;

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
      command: "rd-git.switchBranch",
      title: "Switch Branch",
      arguments: [branchName]
    };
    this.contextValue = "rd-git.branchItem";
    this.description = isCurrent ? `current • ${lastCommitDescription}` : lastCommitDescription;
  }
}

class RecentBranchesProvider implements vscode.TreeDataProvider<BranchItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<BranchItem | undefined | void>();
  private readonly execFileAsync = promisify(execFile) as unknown as ExecFileAsync;
  private repository: Repository | undefined;

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private readonly state: vscode.Memento;
  private readonly logStore: LogStore;

  public constructor(state: vscode.Memento, logStore: LogStore) {
    this.state = state;
    this.logStore = logStore;
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
    return branches.map((branch) => new BranchItem(branch.name, branch.isCurrent, branch.lastCommitDescription));
  }

  public async getRecentBranches(): Promise<RecentBranch[]> {
    if (!this.repository) {
      return [];
    }

    const mru = this.getMruForCurrentRepo();
    const baseBranchName = await this.getBaseBranchName();
    const orderedBranchNames: string[] = [];
    if (baseBranchName) {
      orderedBranchNames.push(baseBranchName);
    }
    for (const branchName of mru) {
      if (branchName === baseBranchName) {
        continue;
      }
      orderedBranchNames.push(branchName);
    }
    const filtered = orderedBranchNames.slice(0, MAX_VISIBLE_BRANCHES);
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

  public async getBaseBranchName() {
    if (!this.repository) {
      return "main";
    }

    try {
      const stdout = await this.runGitCommand(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
      const normalized = this.normalizeBranchName(stdout.trim());
      if (normalized.startsWith("origin/")) {
        return normalized.slice("origin/".length);
      }
      return normalized || "main";
    } catch {
      this.logStore.warn("branches", "Falling back to base branch 'main'.");
      return "main";
    }
  }

  private getStorageKey(repoPath: string) {
    return `rd-git.mru.${repoPath}`;
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
      const stdout = await this.runGitCommand(["log", "-1", "--format=%ct", branchName]);
      const timestampSeconds = Number(stdout.trim());
      if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
        return "no commits";
      }
      return this.formatRelativeTime(timestampSeconds * 1000);
    } catch {
      return "no commits";
    }
  }

  private async runGitCommand(args: string[]) {
    if (!this.repository) {
      throw new Error("Missing repository.");
    }
    const commandString = `git ${args.join(" ")}`;
    this.logStore.info("git", `$ ${commandString}`);
    try {
      const { stdout, stderr } = await this.execFileAsync("git", args, {
        cwd: this.repository.rootUri.fsPath
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
