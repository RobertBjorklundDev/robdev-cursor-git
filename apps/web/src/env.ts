declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

function isVSCodeWebview(): boolean {
  return typeof acquireVsCodeApi === "function";
}

export { isVSCodeWebview };
