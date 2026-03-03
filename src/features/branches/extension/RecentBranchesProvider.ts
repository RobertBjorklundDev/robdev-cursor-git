import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LogStore } from "../../logs/extension";
import type { Repository } from "../../../shared/extension";
import type { RecentBranch } from "../../../shared/webview/contracts";

const MAX_STORED_BRANCHES = 20;
const PRIMARY_BRANCH_COUNT = 5;
const PRIMARY_NON_BASE_BRANCH_COUNT = 4;

type ExecFileAsync = (
  file: string,
  args: string[],
  options: { cwd: string },
) => Promise<{ stdout: string; stderr: string }>;

class BranchItem extends vscode.TreeItem {
  public readonly branchName: string;

  public constructor(
    branchName: string,
    isCurrent: boolean,
    lastCommitDescription: string,
  ) {
    super(branchName, vscode.TreeItemCollapsibleState.None);
    this.branchName = branchName;
    this.command = {
      command: "rd-git.switchBranch",
      title: "Switch Branch",
      arguments: [branchName],
    };
    this.contextValue = "rd-git.branchItem";
    this.description = isCurrent
      ? `current • ${lastCommitDescription}`
      : lastCommitDescription;
  }
}

class RecentBranchesProvider implements vscode.TreeDataProvider<BranchItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    BranchItem | undefined | void
  >();
  private readonly execFileAsync = promisify(
    execFile,
  ) as unknown as ExecFileAsync;
  private repository: Repository | undefined;
  private readonly startupPrimaryBranchesByRepo = new Map<string, string[]>();

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private readonly state: vscode.Memento;
  private readonly logStore: LogStore;

  public constructor(state: vscode.Memento, logStore: LogStore) {
    this.state = state;
    this.logStore = logStore;
  }

  public setRepository(repository: Repository | undefined) {
    if (this.repository === repository) {
      return;
    }
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
    const updated = [normalizedBranchName, ...deduped].slice(
      0,
      MAX_STORED_BRANCHES,
    );
    await this.state.update(
      this.getStorageKey(this.repository.rootUri.fsPath),
      updated,
    );
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
      (branch) =>
        new BranchItem(
          branch.name,
          branch.isCurrent,
          branch.lastCommitDescription,
        ),
    );
  }

  public async getRecentBranches(): Promise<RecentBranch[]> {
    const groupedBranches = await this.getGroupedBranches();
    return groupedBranches.primaryBranches;
  }

  public async getGroupedBranches(): Promise<{
    baseBranchName: string;
    branches: RecentBranch[];
    primaryBranches: RecentBranch[];
    otherBranches: RecentBranch[];
  }> {
    if (!this.repository) {
      return {
        baseBranchName: "main",
        branches: [],
        primaryBranches: [],
        otherBranches: [],
      };
    }

    const mru = this.getMruForCurrentRepo();
    const baseBranchName = await this.getBaseBranchName();
    const repoStorageKey = this.getStorageKey(this.repository.rootUri.fsPath);
    const alphabeticBranchNames = await this.getAlphabeticBranchNames(
      baseBranchName,
      mru,
    );
    const startupPrimaryBranchNames = this.getOrCreateStartupPrimaryBranchNames(
      repoStorageKey,
      baseBranchName,
      mru,
      alphabeticBranchNames,
    );
    const primaryBranchNames = this.getCurrentPrimaryBranchNames(
      startupPrimaryBranchNames,
      alphabeticBranchNames,
    );
    const primaryBranchNameSet = new Set(primaryBranchNames);
    const otherBranchNames = alphabeticBranchNames.filter(
      (branchName) => !primaryBranchNameSet.has(branchName),
    );
    const allBranchNames = [...primaryBranchNames, ...otherBranchNames];
    const headName = this.normalizeBranchName(
      this.repository.state.HEAD?.name ?? "",
    );
    const inferredParents = await this.inferParentBranches(
      allBranchNames,
      baseBranchName,
    );
    const items = await Promise.all(
      allBranchNames.map(async (name) => {
        const description = await this.getLastCommitDescription(name);
        return {
          name,
          isCurrent: name === headName,
          lastCommitDescription: description,
          inferredParentBranchName: inferredParents.get(name),
        };
      }),
    );
    const primaryBranches = items.slice(0, primaryBranchNames.length);
    const otherBranches = items.slice(primaryBranchNames.length);
    return {
      baseBranchName,
      branches: items,
      primaryBranches,
      otherBranches,
    };
  }

  public async getBaseBranchName() {
    if (!this.repository) {
      return "main";
    }

    try {
      const stdout = await this.runGitCommand([
        "symbolic-ref",
        "--short",
        "refs/remotes/origin/HEAD",
      ]);
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

  private async getAlphabeticBranchNames(
    baseBranchName: string,
    mru: string[],
  ) {
    const localBranchNames = await this.getLocalBranchNames();
    const headName = this.normalizeBranchName(
      this.repository?.state.HEAD?.name ?? "",
    );
    const branchNameSet = new Set<string>();
    if (baseBranchName) {
      branchNameSet.add(baseBranchName);
    }
    if (headName) {
      branchNameSet.add(headName);
    }
    for (const branchName of localBranchNames) {
      branchNameSet.add(branchName);
    }
    for (const branchName of mru) {
      branchNameSet.add(branchName);
    }
    return Array.from(branchNameSet).sort((firstBranchName, secondBranchName) =>
      firstBranchName.localeCompare(secondBranchName),
    );
  }

  private getOrCreateStartupPrimaryBranchNames(
    repoStorageKey: string,
    baseBranchName: string,
    mru: string[],
    alphabeticBranchNames: string[],
  ) {
    const existing = this.startupPrimaryBranchesByRepo.get(repoStorageKey);
    if (existing) {
      return existing;
    }

    const alphabeticSet = new Set(alphabeticBranchNames);
    const startupPrimaryBranchNames: string[] = [];
    if (baseBranchName && alphabeticSet.has(baseBranchName)) {
      startupPrimaryBranchNames.push(baseBranchName);
    }

    for (const branchName of mru) {
      if (branchName === baseBranchName || !alphabeticSet.has(branchName)) {
        continue;
      }
      if (startupPrimaryBranchNames.includes(branchName)) {
        continue;
      }
      startupPrimaryBranchNames.push(branchName);
      if (startupPrimaryBranchNames.length >= PRIMARY_BRANCH_COUNT) {
        break;
      }
    }

    this.startupPrimaryBranchesByRepo.set(
      repoStorageKey,
      startupPrimaryBranchNames,
    );
    return startupPrimaryBranchNames;
  }

  private getCurrentPrimaryBranchNames(
    startupPrimaryBranchNames: string[],
    alphabeticBranchNames: string[],
  ) {
    const alphabeticSet = new Set(alphabeticBranchNames);
    const primaryBranchNames: string[] = [];

    for (const branchName of startupPrimaryBranchNames) {
      if (
        !alphabeticSet.has(branchName) ||
        primaryBranchNames.includes(branchName)
      ) {
        continue;
      }
      primaryBranchNames.push(branchName);
      if (primaryBranchNames.length >= PRIMARY_BRANCH_COUNT) {
        return primaryBranchNames;
      }
    }

    let nonBaseBranchCount =
      primaryBranchNames.length > 0 ? primaryBranchNames.length - 1 : 0;
    for (const branchName of alphabeticBranchNames) {
      if (primaryBranchNames.includes(branchName)) {
        continue;
      }
      if (primaryBranchNames.length === 0) {
        primaryBranchNames.push(branchName);
        continue;
      }
      if (nonBaseBranchCount >= PRIMARY_NON_BASE_BRANCH_COUNT) {
        continue;
      }
      primaryBranchNames.push(branchName);
      nonBaseBranchCount += 1;
      if (primaryBranchNames.length >= PRIMARY_BRANCH_COUNT) {
        break;
      }
    }

    return primaryBranchNames.slice(0, PRIMARY_BRANCH_COUNT);
  }

  private getMruForCurrentRepo() {
    if (!this.repository) {
      return [];
    }

    const raw = this.state.get<string[]>(
      this.getStorageKey(this.repository.rootUri.fsPath),
      [],
    );
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
      const stdout = await this.runGitCommand([
        "log",
        "-1",
        "--format=%ct",
        branchName,
      ]);
      const timestampSeconds = Number(stdout.trim());
      if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
        return "no commits";
      }
      return this.formatRelativeTime(timestampSeconds * 1000);
    } catch {
      return "no commits";
    }
  }

  private async inferParentBranches(
    branchNames: string[],
    baseBranchName: string,
  ) {
    const inferredParents = new Map<string, string | undefined>();
    const candidateBranches = await this.getCandidateParentBranches(
      baseBranchName,
    );

    await Promise.all(
      branchNames.map(async (branchName) => {
        const inferredParent = await this.inferParentBranch(
          branchName,
          candidateBranches,
          baseBranchName,
        );
        inferredParents.set(branchName, inferredParent);
      }),
    );

    return inferredParents;
  }

  private async getCandidateParentBranches(
    baseBranchName: string,
  ) {
    const localBranches = await this.getLocalBranchNames();
    const mruBranches = this.getMruForCurrentRepo();
    const candidates = new Set<string>();
    if (baseBranchName) {
      candidates.add(baseBranchName);
    }
    for (const localBranch of localBranches) {
      candidates.add(localBranch);
    }
    for (const mruBranch of mruBranches) {
      candidates.add(mruBranch);
    }
    return Array.from(candidates);
  }

  private async inferParentBranch(
    branchName: string,
    candidateBranches: string[],
    baseBranchName: string,
  ) {
    const parentCandidates = candidateBranches.filter(
      (candidateBranchName) => candidateBranchName !== branchName,
    );

    if (!parentCandidates.length) {
      return baseBranchName;
    }

    const directAncestorCandidates = await this.findDirectAncestorCandidates(
      branchName,
      parentCandidates,
    );
    if (directAncestorCandidates.length > 0) {
      const selected = directAncestorCandidates.sort(
        (first, second) => second.commitTimestamp - first.commitTimestamp,
      )[0];
      this.logStore.info(
        "branches",
        `Inferred parent for '${branchName}' as '${selected.branchName}' (direct ancestor).`,
      );
      return selected.branchName;
    }

    const mergeBaseCandidates = await this.findMergeBaseCandidates(
      branchName,
      parentCandidates,
    );
    if (mergeBaseCandidates.length > 0) {
      const selected = mergeBaseCandidates.sort(
        (first, second) => second.mergeBaseTimestamp - first.mergeBaseTimestamp,
      )[0];
      this.logStore.info(
        "branches",
        `Inferred parent for '${branchName}' as '${selected.branchName}' (latest merge-base).`,
      );
      return selected.branchName;
    }

    this.logStore.warn(
      "branches",
      `Could not infer parent for '${branchName}'. Falling back to '${baseBranchName}'.`,
    );
    return baseBranchName;
  }

  private async findDirectAncestorCandidates(
    branchName: string,
    candidateBranches: string[],
  ) {
    const matches = await Promise.all(
      candidateBranches.map(async (candidateBranchName) => {
        const isAncestor = await this.isAncestor(
          candidateBranchName,
          branchName,
        );
        if (!isAncestor) {
          return undefined;
        }
        const commitTimestamp =
          await this.getBranchHeadTimestamp(candidateBranchName);
        return {
          branchName: candidateBranchName,
          commitTimestamp,
        };
      }),
    );
    return matches.filter(
      (value): value is { branchName: string; commitTimestamp: number } =>
        !!value,
    );
  }

  private async findMergeBaseCandidates(
    branchName: string,
    candidateBranches: string[],
  ) {
    const matches = await Promise.all(
      candidateBranches.map(async (candidateBranchName) => {
        const mergeBase = await this.getMergeBase(
          branchName,
          candidateBranchName,
        );
        if (!mergeBase) {
          return undefined;
        }
        const mergeBaseTimestamp = await this.getCommitTimestamp(mergeBase);
        if (!Number.isFinite(mergeBaseTimestamp) || mergeBaseTimestamp <= 0) {
          return undefined;
        }
        return {
          branchName: candidateBranchName,
          mergeBaseTimestamp,
        };
      }),
    );
    return matches.filter(
      (value): value is { branchName: string; mergeBaseTimestamp: number } =>
        !!value,
    );
  }

  private async getLocalBranchNames() {
    try {
      const stdout = await this.runGitCommand([
        "for-each-ref",
        "--format=%(refname:short)",
        "refs/heads",
      ]);
      return stdout
        .split("\n")
        .map((line) => this.normalizeBranchName(line.trim()))
        .filter((name) => name.length > 0);
    } catch {
      return [];
    }
  }

  private async isAncestor(
    ancestorBranchName: string,
    targetBranchName: string,
  ) {
    if (!this.repository) {
      return false;
    }
    try {
      await this.execFileAsync(
        "git",
        ["merge-base", "--is-ancestor", ancestorBranchName, targetBranchName],
        {
          cwd: this.repository.rootUri.fsPath,
        },
      );
      return true;
    } catch {
      return false;
    }
  }

  private async getMergeBase(
    firstBranchName: string,
    secondBranchName: string,
  ) {
    try {
      const stdout = await this.runGitCommand([
        "merge-base",
        firstBranchName,
        secondBranchName,
      ]);
      const mergeBase = stdout.trim();
      if (!mergeBase) {
        return undefined;
      }
      return mergeBase;
    } catch {
      return undefined;
    }
  }

  private async getBranchHeadTimestamp(branchName: string) {
    return this.getCommitTimestamp(branchName);
  }

  private async getCommitTimestamp(revision: string) {
    try {
      const stdout = await this.runGitCommand([
        "log",
        "-1",
        "--format=%ct",
        revision,
      ]);
      const timestampSeconds = Number(stdout.trim());
      if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
        return 0;
      }
      return timestampSeconds;
    } catch {
      return 0;
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
        cwd: this.repository.rootUri.fsPath,
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
      const message =
        error instanceof Error ? error.message : "Unknown git command error";
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
