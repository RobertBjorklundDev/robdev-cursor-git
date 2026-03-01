import * as vscode from "vscode";
import type { LogEntry, LogLevel } from "../../../shared/webview/contracts";

const MAX_LOG_ENTRIES = 500;

class LogStore {
  private readonly entries: LogEntry[] = [];
  private readonly onDidAppendEmitter = new vscode.EventEmitter<LogEntry>();

  public readonly onDidAppend = this.onDidAppendEmitter.event;

  public getEntries() {
    return [...this.entries];
  }

  public info(category: string, message: string) {
    this.append("info", category, message);
  }

  public warn(category: string, message: string) {
    this.append("warn", category, message);
  }

  public error(category: string, message: string) {
    this.append("error", category, message);
  }

  public clear() {
    this.entries.length = 0;
  }

  private append(level: LogLevel, category: string, message: string) {
    const entry: LogEntry = {
      timestampIso: new Date().toISOString(),
      level,
      category,
      message
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_LOG_ENTRIES);
    }
    this.onDidAppendEmitter.fire(entry);
  }
}

export { LogStore };
export type { LogEntry, LogLevel };
