const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const outputDir = path.join(rootDir, "dist", "packages");

function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

function getVsceCommand() {
  if (process.platform === "win32") {
    return "npx.cmd";
  }

  return "npx";
}

function getNpmCommand() {
  if (process.platform === "win32") {
    return "npm.cmd";
  }

  return "npm";
}

function buildVsixFileName(packageJson) {
  if (typeof packageJson.publisher !== "string" || packageJson.publisher.length === 0) {
    return `${packageJson.name}-${packageJson.version}.vsix`;
  }

  return `${packageJson.publisher}.${packageJson.name}-${packageJson.version}.vsix`;
}

function bumpPatchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Unsupported version format: "${version}". Expected x.y.z`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]) + 1;
  return `${major}.${minor}.${patch}`;
}

function writePackageJson(packageJson) {
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

function run() {
  execFileSync(getNpmCommand(), ["run", "build"], {
    cwd: rootDir,
    stdio: "inherit"
  });

  const packageJson = readJsonFile(packageJsonPath);
  const nextVersion = bumpPatchVersion(packageJson.version);
  const nextBuildCode = randomUUID();

  packageJson.version = nextVersion;
  packageJson.robdevBuildCode = nextBuildCode;
  writePackageJson(packageJson);
  fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = buildVsixFileName(packageJson);
  const outputPath = path.join(outputDir, outputFile);

  execFileSync(getVsceCommand(), ["vsce", "package", "--out", outputPath], {
    cwd: rootDir,
    stdio: "inherit"
  });

  process.stdout.write(`\nCreated package: ${path.relative(rootDir, outputPath)}\n`);
}

run();
