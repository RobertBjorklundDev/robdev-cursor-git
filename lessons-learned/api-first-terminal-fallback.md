# API First, Terminal Fallback

## Decision rule

Use APIs first whenever the action can be completed reliably through:

- VS Code/Cursor extension APIs (for example Git API, auth APIs, command APIs), or
- GitHub APIs (REST/GraphQL).

Use terminal dispatch when an action can enter complex, interactive, or failure-heavy states where terminal-native handling is better than custom UI.

## Why

- API actions update extension state more reliably and reduce UI-only state drift.
- Terminal actions are still best for conflict-heavy git workflows and interactive prompts.

## Current examples in this repo

- API: switch branch (`repository.checkout`), PR merge/ready/draft/create, auth flows.
- Terminal: pull from origin, push to origin, merge from base, split branch.

## Practical guideline

When implementing a new action:

1. Prefer API path if available and stable.
2. If not, or if failure handling would require large UI complexity, dispatch to terminal and surface logs/notices.
3. Keep the UI thin for terminal-backed operations and rely on terminal for resolution.
