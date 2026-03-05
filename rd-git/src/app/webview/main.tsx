import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./AppShell";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing root element for webview.");
}

const root = createRoot(rootElement);
root.render(<AppShell />);
