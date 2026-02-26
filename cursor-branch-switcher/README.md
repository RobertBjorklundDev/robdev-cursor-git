# Cursor Branch Switcher

Shows the top 5 most recently used local branches for the current Git repository and lets you switch with one click.

## What it does

- Adds a `Branch Switcher` icon in the Activity Bar.
- Shows `Recent Branches` in a Tree View.
- Tracks branch changes through Git API events.
- Stores per-repository MRU lists in `workspaceState`.

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
