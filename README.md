# RDgit

Shows the top 5 most recently used local branches for the current Git repository and lets you switch with one click.

## What it does

- Adds an `RDgit` icon in the Activity Bar.
- Shows `Recent Branches` in a Tree View.
- Tracks branch changes through Git API events.
- Stores per-repository MRU lists in `workspaceState`.
- Runs branch switch, pull, and merge commands in a visible terminal (`RDgit`).

## Command templates (settings)

You can customize terminal commands in Settings:

- `rd-git.gitCommands.switchBranch` (default: `git checkout {{targetBranch}}`)
- `rd-git.gitCommands.pullFromOrigin` (default: `git pull`)
- `rd-git.gitCommands.mergeFromBase` (default: `git merge {{baseBranch}}`)

Available placeholders:

- `{{targetBranch}}`
- `{{baseBranch}}`

Example: use `git switch` instead of checkout:

- Set `rd-git.gitCommands.switchBranch` to `git switch {{targetBranch}}`

Reset to defaults:

- Open Settings UI, find the setting, and choose **Reset Setting**.

## Local development

1. Install dependencies:
   - `npm install`
2. Build:
   - `npm run build`
3. Launch Extension Development Host:
   - Press `F5` in VS Code/Cursor (extension workspace open)

## Package as VSIX

1. Run:
   - `npm run package`
2. Install in Cursor:
   - Command Palette -> `Install from VSIX`

## Local iteration loop

Use this to build, package, reinstall, and reload quickly while developing:

- `npm run dev:local`

What it does:

- Runs the existing packaging flow (`npm run package`)
- Force-installs the generated `.vsix` into Cursor
- Attempts to trigger `Developer: Reload Window` automatically on macOS

If automatic reload is blocked (for example by macOS accessibility permissions), run `Developer: Reload Window` manually in Cursor.
