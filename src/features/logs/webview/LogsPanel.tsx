import React, { useEffect, useRef } from "react";
import { useWebviewAppContext } from "../../../app/webview/context/WebviewAppContext";
import { Card } from "../../../shared/webview/components";
import { formatLogTimestamp, getLogLevelColor } from "./logFormatting";

function LogsPanel() {
  const { activeTab, isLogAutoScrollEnabled, logs, setIsLogAutoScrollEnabled } = useWebviewAppContext();
  const logsContainerRef = useRef<HTMLDivElement | null>(null);

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
  }, [activeTab, isLogAutoScrollEnabled, logs]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Card className="mb-2 w-full px-3 py-2.5 font-bold" padding="none">
        Logs
      </Card>
      <Card className="mb-2 flex items-center px-3 py-2" padding="none">
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
      </Card>
      <Card
        className="min-h-0 flex-1 overflow-auto font-mono text-xs"
        padding="sm"
        ref={logsContainerRef}
      >
        {logs.length === 0 ? (
          <div className="text-(--vscode-descriptionForeground)">No logs yet.</div>
        ) : (
          logs.map((logEntry, index) => (
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
