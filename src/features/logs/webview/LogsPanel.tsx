import React, { useEffect, useMemo, useRef } from "react";
import { useWebviewAppContext } from "../../../app/webview/context/WebviewAppContext";
import { Button, Card } from "../../../shared/webview/components";
import { formatLogTimestamp, getLogLevelColor } from "./logFormatting";

function LogsPanel() {
  const {
    activeLogLevels,
    activeTab,
    isLogAutoScrollEnabled,
    logs,
    postClearLogs,
    setActiveLogLevels,
    setIsLogAutoScrollEnabled
  } = useWebviewAppContext();
  const logsContainerRef = useRef<HTMLDivElement | null>(null);
  const filteredLogs = useMemo(
    () => logs.filter((logEntry) => activeLogLevels.includes(logEntry.level)),
    [activeLogLevels, logs]
  );

  function toggleLogLevel(level: "info" | "warn" | "error") {
    if (activeLogLevels.includes(level)) {
      setActiveLogLevels(activeLogLevels.filter((selectedLevel) => selectedLevel !== level));
      return;
    }
    setActiveLogLevels([...activeLogLevels, level]);
  }

  useEffect(() => {
    if (activeTab !== "logs") {
      return;
    }
    if (!isLogAutoScrollEnabled) {
      return;
    }
    const logsContainer = logsContainerRef.current;
    if (!logsContainer) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    });
    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [activeTab, filteredLogs, isLogAutoScrollEnabled]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Card className="mb-2 w-full px-3 py-2.5 font-bold" padding="none">
        <div className="flex items-center justify-between gap-2">
          <span>Logs</span>
          <Button size="sm" variant="secondary" onClick={postClearLogs}>
            Clear logs
          </Button>
        </div>
      </Card>
      <Card className="mb-2 flex items-center justify-between gap-2 px-3 py-2" padding="none">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            checked={isLogAutoScrollEnabled}
            className="cursor-pointer"
            onChange={(event) => {
              setIsLogAutoScrollEnabled(event.target.checked);
            }}
            type="checkbox"
          />
          <span>Auto-scroll to newest logs</span>
        </label>
        <details className="text-xs">
          <summary className="cursor-pointer select-none">Levels ({activeLogLevels.length})</summary>
          <div className="mt-2 flex flex-col gap-1">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={activeLogLevels.includes("info")}
                onChange={() => {
                  toggleLogLevel("info");
                }}
                type="checkbox"
              />
              <span>Info</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={activeLogLevels.includes("warn")}
                onChange={() => {
                  toggleLogLevel("warn");
                }}
                type="checkbox"
              />
              <span>Warn</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={activeLogLevels.includes("error")}
                onChange={() => {
                  toggleLogLevel("error");
                }}
                type="checkbox"
              />
              <span>Error</span>
            </label>
          </div>
        </details>
      </Card>
      <Card
        className="min-h-0 flex-1 overflow-auto font-mono text-xs"
        padding="sm"
        ref={logsContainerRef}
      >
        {filteredLogs.length === 0 ? (
          <div className="text-(--vscode-descriptionForeground)">No logs yet.</div>
        ) : (
          filteredLogs.map((logEntry, index) => (
            <div className="mb-1.5 wrap-break-word" key={`${logEntry.timestampIso}-${index}`}>
              <span className="text-(--vscode-descriptionForeground)">
                [{formatLogTimestamp(logEntry.timestampIso)}]
              </span>
              <span className="px-1 text-(--vscode-descriptionForeground)">[</span>
              <span style={{ color: getLogLevelColor(logEntry.level) }}>
                {logEntry.level.toUpperCase()}
              </span>
              <span className="px-1 text-(--vscode-descriptionForeground)">]</span>
              <span className="text-(--vscode-descriptionForeground)">[{logEntry.category}]</span>
              <span className="px-1">{logEntry.message}</span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

export { LogsPanel };
