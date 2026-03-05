import React from "react";
import { useWebviewAppContext } from "../../../app/webview/context/WebviewAppContext";
import { Card } from "../../../shared/webview/components";

function SettingsPanel() {
  const { assets } = useWebviewAppContext();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto pr-1">
      <Card className="mb-2 w-full px-3 py-2 text-sm font-semibold" padding="none">
        Settings
      </Card>
      <Card className="mt-2">
        <div className="mb-1 text-xs text-muted-foreground">About</div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Version</span>
          <span className="font-mono text-xs">{assets.extensionVersion}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Build code</span>
          <span className="font-mono text-xs">{assets.extensionBuildCode}</span>
        </div>
      </Card>
    </div>
  );
}

export { SettingsPanel };
