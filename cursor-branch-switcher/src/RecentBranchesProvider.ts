import * as vscode from "vscode";
import type { Repository } from "./types";

const MAX_STORED_BRANCHES = 20;
const MAX_VISIBLE_BRANCHES = 5;

class BranchItem extends vscode.TreeItem {
  public readonly branchName: string;

  public constructor(branchName: string, isCurrent: boolean) {
    super(branchName, vscode.TreeItemCollapsibleState.None);
    this.branchName = branchName;
    this.command = {
      command: "branchSwitcher.switchBranch",
      title: "Switch Branch",
      arguments: [branchName]
    };
    this.contextValue = "branchSwitcher.branchItem";
    if (isCurrent) {
      this.description = "current";
    }
  }
}

class RecentBranchesProvider implements vscode.TreeDataProvider<BranchItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<BranchItem | undefined | void>();
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

  public getChildren() {
    if (!this.repository) {
      return Promise.resolve([]);
    }

    const mru = this.getMruForCurrentRepo();
    const filtered = mru.slice(0, MAX_VISIBLE_BRANCHES);
    const headName = this.normalizeBranchName(this.repository.state.HEAD?.name ?? "");
    const items = filtered.map((name) => new BranchItem(name, name === headName));
    return Promise.resolve(items);
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
}

export { RecentBranchesProvider };
