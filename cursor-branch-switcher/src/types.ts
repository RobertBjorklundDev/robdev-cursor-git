import * as vscode from "vscode";

enum RefType {
  Head = 0,
  RemoteHead = 1,
  Tag = 2
}

interface Ref {
  readonly name?: string;
  readonly type: RefType;
}

interface RepositoryState {
  readonly HEAD: Ref | undefined;
  readonly refs: Ref[];
  readonly onDidChange: vscode.Event<void>;
}

interface Repository {
  readonly rootUri: vscode.Uri;
  readonly state: RepositoryState;
  checkout(treeish: string): Promise<void>;
}

interface GitAPI {
  readonly repositories: Repository[];
  readonly onDidOpenRepository: vscode.Event<Repository>;
  readonly onDidCloseRepository: vscode.Event<Repository>;
}

interface GitExtensionExports {
  getAPI(version: 1): GitAPI;
}

export { RefType };
export type { GitAPI, GitExtensionExports, Ref, Repository };
