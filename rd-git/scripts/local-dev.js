const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const outputDir = path.join(rootDir, "dist", "packages");

function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

function getNpmCommand() {
  if (process.platform === "win32") {
    return "npm.cmd";
  }

  return "npm";
}

function getCursorCommand() {
  if (process.platform === "win32") {
    return "cursor.cmd";
  }

  return "cursor";
}

function buildVsixFileName(packageJson) {
  if (typeof packageJson.publisher !== "string" || packageJson.publisher.length === 0) {
    return `${packageJson.name}-${packageJson.version}.vsix`;
  }

  return `${packageJson.publisher}.${packageJson.name}-${packageJson.version}.vsix`;
}

function buildVsixPath() {
  const packageJson = readJsonFile(packageJsonPath);
  const outputFile = buildVsixFileName(packageJson);
  return path.join(outputDir, outputFile);
}

function runPackageScript() {
  execFileSync(getNpmCommand(), ["run", "package"], {
    cwd: rootDir,
    stdio: "inherit"
  });
}

function installVsix(vsixPath) {
  execFileSync(getCursorCommand(), ["--install-extension", vsixPath, "--force"], {
    cwd: rootDir,
    stdio: "inherit"
  });
}

function tryReloadCursorWindow() {
  if (process.platform !== "darwin") {
    return false;
  }

  const appleScript = `
    tell application "Cursor" to activate
    delay 0.2
    tell application "System Events"
      keystroke "p" using {command down, shift down}
      delay 0.2
      keystroke "Developer: Reload Window"
      key code 36
    end tell
  `;

  try {
    execFileSync("osascript", ["-e", appleScript], {
      cwd: rootDir,
      stdio: "ignore"
    });
    return true;
  } catch (error) {
    return false;
  }
}

function run() {
  runPackageScript();

  const vsixPath = buildVsixPath();
  if (!fs.existsSync(vsixPath)) {
    throw new Error(`Expected package not found: ${path.relative(rootDir, vsixPath)}`);
  }

  installVsix(vsixPath);
  const reloaded = tryReloadCursorWindow();

  process.stdout.write(`\nInstalled: ${path.relative(rootDir, vsixPath)}\n`);
  if (reloaded) {
    process.stdout.write("Cursor UI reload triggered automatically.\n");
  } else {
    process.stdout.write("Run 'Developer: Reload Window' in Cursor to load the update.\n");
  }
}

run();
