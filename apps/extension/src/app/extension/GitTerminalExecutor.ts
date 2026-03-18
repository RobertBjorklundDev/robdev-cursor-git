import * as vscode from "vscode";

const DEFAULT_TERMINAL_NAME = "RDgit";

interface GitTerminalExecutorOptions {
  terminalName?: string;
}

type TerminalDispatchStep = "createOrReuse" | "show" | "focus" | "sendText";

interface TerminalDispatchResult {
  ok: boolean;
  terminalName: string;
  lifecycle: "created" | "reused";
  errorMessage?: string;
  failedStep?: TerminalDispatchStep;
}

class GitTerminalExecutor implements vscode.Disposable {
  private readonly terminalName: string;
  private readonly subscriptions: vscode.Disposable[] = [];
  private terminal: vscode.Terminal | undefined;

  public constructor(options?: GitTerminalExecutorOptions) {
    this.terminalName = options?.terminalName ?? DEFAULT_TERMINAL_NAME;
    this.subscriptions.push(
      vscode.window.onDidCloseTerminal((closedTerminal) => {
        if (closedTerminal === this.terminal) {
          this.terminal = undefined;
        }
      })
    );
  }

  public getTerminalName() {
    return this.terminalName;
  }

  public runCommand(repositoryPath: string, command: string): TerminalDispatchResult {
    let ensuredTerminal: vscode.Terminal;
    let lifecycle: "created" | "reused";
    try {
      const result = this.ensureTerminal(repositoryPath);
      ensuredTerminal = result.terminal;
      lifecycle = result.lifecycle;
    } catch (error) {
      return {
        ok: false,
        terminalName: this.terminalName,
        lifecycle: "reused",
        errorMessage: toErrorMessage(error),
        failedStep: "createOrReuse"
      };
    }

    try {
      ensuredTerminal.show(true);
    } catch (error) {
      return {
        ok: false,
        terminalName: ensuredTerminal.name,
        lifecycle,
        errorMessage: toErrorMessage(error),
        failedStep: "show"
      };
    }

    try {
      void vscode.commands.executeCommand("workbench.action.terminal.focus");
    } catch (error) {
      return {
        ok: false,
        terminalName: ensuredTerminal.name,
        lifecycle,
        errorMessage: toErrorMessage(error),
        failedStep: "focus"
      };
    }

    try {
      ensuredTerminal.sendText(`cd "${escapeDoubleQuotes(repositoryPath)}"`, true);
      ensuredTerminal.sendText(command, true);
    } catch (error) {
      return {
        ok: false,
        terminalName: ensuredTerminal.name,
        lifecycle,
        errorMessage: toErrorMessage(error),
        failedStep: "sendText"
      };
    }

    return {
      ok: true,
      terminalName: ensuredTerminal.name,
      lifecycle
    };
  }

  public dispose() {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
    this.terminal?.dispose();
    this.terminal = undefined;
  }

  private ensureTerminal(repositoryPath: string) {
    const existingTerminal =
      this.terminal && vscode.window.terminals.includes(this.terminal)
        ? this.terminal
        : vscode.window.terminals.find((terminal) => terminal.name === this.terminalName);

    if (existingTerminal) {
      this.terminal = existingTerminal;
      return {
        terminal: existingTerminal,
        lifecycle: "reused" as const
      };
    }

    this.terminal = vscode.window.createTerminal({
      name: this.terminalName,
      cwd: repositoryPath,
      location: vscode.TerminalLocation.Panel
    });
    return {
      terminal: this.terminal,
      lifecycle: "created" as const
    };
  }
}

function escapeDoubleQuotes(value: string) {
  return value.replace(/"/g, '\\"');
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unknown terminal dispatch error.";
}

export { GitTerminalExecutor };
export type { TerminalDispatchResult };
