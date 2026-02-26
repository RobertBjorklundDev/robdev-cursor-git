# Cursor Extension Plan --- Branch Switcher (Top 5 Recent)

## Overview

This extension adds a simple UI panel in the **left Activity Bar**
(where Explorer / Source Control / Extensions live).

It shows the **5 most recently used local branches** for the current Git
repository and allows switching branches with a single click.

Nothing more. No extra features.

------------------------------------------------------------------------

# 🎯 Goal

When a Git repository is open in Cursor:

-   Show a new icon in the left Activity Bar.
-   Display a list of the **5 most recently used branches**.
-   Clicking a branch switches to it.
-   The list updates automatically when branches change.

------------------------------------------------------------------------

# 🧱 Architecture Overview

## UI Location

-   **Activity Bar icon**
-   A **TreeView** inside the Side Bar
-   No Webview required (keep it simple)

------------------------------------------------------------------------

## Data Model

We maintain a **per-repository MRU list (Most Recently Used branches)**.

### Storage

-   Use `context.workspaceState`
-   Keyed by repository root path
-   Store: `string[]` (most recent first)
-   Cap at 20 stored entries
-   Display only top 5

------------------------------------------------------------------------

# 🔄 How Branch Tracking Works

We do NOT parse `git reflog`.

Instead:

1.  Detect branch changes via Git extension API.
2.  When the active branch changes:
    -   Move branch to top of MRU list.
    -   Remove duplicates.
    -   Persist list.
    -   Refresh UI.

This means: - Switching via our extension updates MRU. - Switching via
Source Control panel also updates MRU.

------------------------------------------------------------------------

# 🧩 Components

## 1. Activation

Activate when:

-   Workspace contains a Git repo.
-   Built-in Git extension is available.

Access Git API via:

``` ts
vscode.extensions.getExtension('vscode.git')
```

Then:

``` ts
const gitApi = gitExtension.exports.getAPI(1)
```

------------------------------------------------------------------------

## 2. Repository Detection

Use:

``` ts
gitApi.repositories
```

If multiple repos exist: - Default to first repo - (Optional
improvement: select repo based on active editor file path)

------------------------------------------------------------------------

## 3. TreeView Provider

Create a `RecentBranchesProvider` implementing:

``` ts
TreeDataProvider<BranchItem>
```

Responsibilities:

-   Read MRU from workspaceState
-   Filter branches that still exist locally
-   Return top 5
-   Mark current branch (optional highlight)

------------------------------------------------------------------------

## 4. Switching Branches

On click:

-   Execute built-in Git switch/checkout command OR use Git API
-   Update MRU list
-   Refresh TreeView

Preferred approach: Use Git API instead of terminal commands.

------------------------------------------------------------------------

## 5. Refresh Logic

Refresh TreeView when:

-   Branch changes (`repo.state.onDidChange`)
-   Extension switches branch
-   Active editor changes (repo context might change)

Use internal `EventEmitter<void>` to trigger refresh.

------------------------------------------------------------------------

# 📁 File Structure

    cursor-branch-switcher/
    │
    ├── package.json
    ├── src/
    │   ├── extension.ts
    │   ├── RecentBranchesProvider.ts
    │   └── types.ts
    │
    ├── tsconfig.json
    └── README.md

------------------------------------------------------------------------

# 📦 package.json Contributions (Conceptual)

## Activity Bar Container

``` json
"viewsContainers": {
  "activitybar": [
    {
      "id": "branchSwitcher",
      "title": "Branch Switcher",
      "icon": "resources/icon.svg"
    }
  ]
}
```

## View

``` json
"views": {
  "branchSwitcher": [
    {
      "id": "recentBranchesView",
      "name": "Recent Branches"
    }
  ]
}
```

## Commands

``` json
"commands": [
  {
    "command": "branchSwitcher.switchBranch",
    "title": "Switch Branch"
  }
]
```

------------------------------------------------------------------------

# 🧠 MRU Algorithm

When branch changes:

1.  Read current MRU list
2.  Remove branch if already exists
3.  Insert at index 0
4.  Trim to max 20
5.  Persist

Display:

``` ts
mru.slice(0, 5)
```

------------------------------------------------------------------------

# ✅ Acceptance Criteria

The extension is considered complete when:

-   [ ] Activity Bar icon appears
-   [ ] Side panel shows "Recent Branches"
-   [ ] Max 5 branches listed
-   [ ] Clicking branch switches successfully
-   [ ] Switching via Git UI updates the list
-   [ ] No publishing required --- works locally via VSIX install

------------------------------------------------------------------------

# 🚀 Development Workflow

## Option A --- Extension Host

1.  Open extension folder in VS Code
2.  Press `F5`
3.  Test in Extension Development Host
4.  Iterate

## Option B --- VSIX (Most Reliable for Cursor)

1.  Package extension:

        vsce package

2.  Install in Cursor:

    -   Command Palette → "Install from VSIX"

3.  Reload window

4.  Iterate

------------------------------------------------------------------------

# 🔒 Scope Boundaries

Not included:

-   No branch creation
-   No remote branch support
-   No pinning
-   No filtering UI
-   No webview
-   No publishing to marketplace

Just:

Top 5 recently used local branches. Click to switch.

------------------------------------------------------------------------

# 📌 Final Summary

This extension:

-   Uses Git API
-   Stores a per-repo MRU list
-   Displays 5 branches in Activity Bar view
-   Switches branches with one click
-   Requires no publishing
-   Works entirely locally

Minimal. Fast. Private. Practical.
