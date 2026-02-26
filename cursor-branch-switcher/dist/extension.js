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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const RecentBranchesProvider_1 = require("./RecentBranchesProvider");
async function activate(context) {
    const gitApi = await getGitApi();
    if (!gitApi) {
        return;
    }
    const api = gitApi;
    const provider = new RecentBranchesProvider_1.RecentBranchesProvider(context.workspaceState);
    const treeDisposable = vscode.window.registerTreeDataProvider("recentBranchesView", provider);
    context.subscriptions.push(treeDisposable);
    const repositorySubscriptions = new Map();
    function getCurrentRepository() {
        const active = provider.getRepository();
        if (active) {
            return active;
        }
        return api.repositories[0];
    }
    async function updateCurrentBranchMru(repository) {
        const headName = repository.state.HEAD?.name;
        if (!headName) {
            return;
        }
        const previous = provider.getRepository();
        provider.setRepository(repository);
        await provider.updateMruBranch(headName);
        if (previous !== repository) {
            provider.setRepository(previous ?? repository);
        }
        provider.refresh();
    }
    function subscribeToRepository(repository) {
        const key = repository.rootUri.fsPath;
        if (repositorySubscriptions.has(key)) {
            return;
        }
        const disposable = repository.state.onDidChange(() => {
            void updateCurrentBranchMru(repository);
        });
        repositorySubscriptions.set(key, disposable);
        context.subscriptions.push(disposable);
    }
    function refreshRepositorySelection() {
        const repo = api.repositories[0];
        provider.setRepository(repo);
    }
    for (const repository of api.repositories) {
        subscribeToRepository(repository);
    }
    refreshRepositorySelection();
    const initialRepo = getCurrentRepository();
    if (initialRepo) {
        void updateCurrentBranchMru(initialRepo);
    }
    const openRepoDisposable = api.onDidOpenRepository((repository) => {
        subscribeToRepository(repository);
        refreshRepositorySelection();
        void updateCurrentBranchMru(repository);
    });
    const closeRepoDisposable = api.onDidCloseRepository((repository) => {
        const key = repository.rootUri.fsPath;
        const disposable = repositorySubscriptions.get(key);
        if (disposable) {
            disposable.dispose();
            repositorySubscriptions.delete(key);
        }
        refreshRepositorySelection();
        provider.refresh();
    });
    const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
        refreshRepositorySelection();
    });
    const switchBranchDisposable = vscode.commands.registerCommand("branchSwitcher.switchBranch", async (branchName) => {
        const repository = getCurrentRepository();
        if (!repository) {
            vscode.window.showWarningMessage("No Git repository is available.");
            return;
        }
        try {
            await repository.checkout(branchName);
            await updateCurrentBranchMru(repository);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            vscode.window.showErrorMessage(`Failed to switch branch: ${message}`);
        }
    });
    const refreshDisposable = vscode.commands.registerCommand("branchSwitcher.refresh", () => {
        provider.refresh();
    });
    context.subscriptions.push(openRepoDisposable);
    context.subscriptions.push(closeRepoDisposable);
    context.subscriptions.push(activeEditorDisposable);
    context.subscriptions.push(switchBranchDisposable);
    context.subscriptions.push(refreshDisposable);
}
function deactivate() { }
async function getGitApi() {
    const gitExtension = vscode.extensions.getExtension("vscode.git");
    if (!gitExtension) {
        vscode.window.showWarningMessage("Git extension is not available.");
        return undefined;
    }
    if (!gitExtension.isActive) {
        await gitExtension.activate();
    }
    const api = gitExtension.exports.getAPI(1);
    return api;
}
//# sourceMappingURL=extension.js.map