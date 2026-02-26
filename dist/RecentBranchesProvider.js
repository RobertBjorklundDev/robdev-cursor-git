"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecentBranchesProvider = void 0;
const vscode = __importStar(require("vscode"));
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const MAX_STORED_BRANCHES = 20;
const MAX_VISIBLE_BRANCHES = 5;
class BranchItem extends vscode.TreeItem {
    constructor(branchName, isCurrent, lastCommitDescription) {
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
class RecentBranchesProvider {
    constructor(state) {
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter();
        this.execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
        this.state = state;
    }
    setRepository(repository) {
        this.repository = repository;
        this.refresh();
    }
    getRepository() {
        return this.repository;
    }
    async updateMruBranch(branchName) {
        if (!this.repository) {
            return;
        }
        const normalizedBranchName = this.normalizeBranchName(branchName);
        const current = this.getMruForCurrentRepo();
        const deduped = current.filter((name) => name !== normalizedBranchName);
        const updated = [normalizedBranchName, ...deduped].slice(0, MAX_STORED_BRANCHES);
        await this.state.update(this.getStorageKey(this.repository.rootUri.fsPath), updated);
    }
    refresh() {
        this.onDidChangeTreeDataEmitter.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren() {
        if (!this.repository) {
            return [];
        }
        const mru = this.getMruForCurrentRepo();
        const filtered = [...mru].sort((a, b) => a.localeCompare(b)).slice(0, MAX_VISIBLE_BRANCHES);
        const headName = this.normalizeBranchName(this.repository.state.HEAD?.name ?? "");
        const items = await Promise.all(filtered.map(async (name) => {
            const description = await this.getLastCommitDescription(name);
            return new BranchItem(name, name === headName, description);
        }));
        return items;
    }
    getStorageKey(repoPath) {
        return `branchSwitcher.mru.${repoPath}`;
    }
    getMruForCurrentRepo() {
        if (!this.repository) {
            return [];
        }
        const raw = this.state.get(this.getStorageKey(this.repository.rootUri.fsPath), []);
        const normalized = raw.map((name) => this.normalizeBranchName(name));
        const seen = new Set();
        const unique = [];
        for (const name of normalized) {
            if (!name || seen.has(name)) {
                continue;
            }
            seen.add(name);
            unique.push(name);
        }
        return unique;
    }
    normalizeBranchName(branchName) {
        if (branchName.startsWith("refs/heads/")) {
            return branchName.slice("refs/heads/".length);
        }
        if (branchName.startsWith("heads/")) {
            return branchName.slice("heads/".length);
        }
        return branchName;
    }
    async getLastCommitDescription(branchName) {
        if (!this.repository) {
            return "no commits";
        }
        try {
            const { stdout } = await this.execFileAsync("git", ["log", "-1", "--format=%ct", branchName], { cwd: this.repository.rootUri.fsPath });
            const timestampSeconds = Number(stdout.trim());
            if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
                return "no commits";
            }
            return this.formatRelativeTime(timestampSeconds * 1000);
        }
        catch {
            return "no commits";
        }
    }
    formatRelativeTime(timestampMs) {
        const diffMs = Math.max(0, Date.now() - timestampMs);
        const minute = 60000;
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
exports.RecentBranchesProvider = RecentBranchesProvider;
//# sourceMappingURL=RecentBranchesProvider.js.map