import type { LogEntry } from "../../../shared/webview/contracts";

function getLogLevelColor(level: LogEntry["level"]) {
  if (level === "error") {
    return "var(--vscode-testing-iconFailed)";
  }
  if (level === "warn") {
    return "var(--vscode-testing-iconQueued)";
  }
  return "var(--vscode-testing-iconPassed)";
}

function formatLogTimestamp(timestampIso: string) {
  const timestampDate = new Date(timestampIso);
  if (Number.isNaN(timestampDate.getTime())) {
    return timestampIso;
  }
  return timestampDate.toLocaleTimeString();
}

export { formatLogTimestamp, getLogLevelColor };
