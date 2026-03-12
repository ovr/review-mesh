# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run start                # Run the TUI app (bun run src/index.tsx)
bun run typecheck            # Type-check (tsc --noEmit)
bun test                     # Run all tests (Bun test runner)
bun test tests/integration/  # Integration tests only
bun test --grep "pattern"    # Run specific tests by name
```

Set `RUN_REAL_AGENT_TESTS=1` to include tests that invoke real agent subprocesses.

## Architecture

Multi-agent TUI for reviewing GitHub PRs. Two AI agents (Claude + Codex) review code and cross-validate each other's reasoning. Results display in an interactive terminal UI.

### Pipeline (`src/pipeline/`)

`ReviewPipeline` orchestrates three sequential steps: **fetch** (PR data via `gh` CLI) → **review** (Claude agent) → **cross-validation** (Codex agent). It emits typed `PipelineEvent`s consumed by a `reducePipelineState()` function that builds the UI state. Every event carries a `startedAt` timestamp.

### Agents (`src/agents/`)

`BaseAgent` is an abstract class. Subclasses implement `buildCommand()` (CLI args) and `parseOutput()` (JSON extraction). Agents run as subprocesses via `spawnProcess()` — Claude uses the `claude` CLI, Codex uses the `codex` CLI. Output parsing has multi-strategy fallbacks (direct JSON → last line → regex).

### UI (`src/components/`)

Built with `@opentui/react` — a React-based terminal UI framework. JSX renders to terminal elements (`<box>`, `<text>`, `<scrollbox>`, `<select>`). The app has 5 tabs: PRs, Review, Reasoning, Validation, History. State is managed with React hooks in `App` (`src/app.tsx`).

**Important:** JSX is compiled with `jsxImportSource: "@opentui/react"`, not `react-dom`. Components use terminal-specific props (e.g., `fg` for text color, `attributes={1}` for bold, `borderStyle="rounded"`).

### Storage (`src/storage/`)

Sessions persist as JSON files in `~/.review-mesh/data/{repo}_{prNumber}/`. All data types are defined as Zod schemas in `src/storage/types.ts` and validated on load.

### GitHub integration (`src/github/`)

All GitHub data is fetched via the `gh` CLI (`gh pr list`, `gh pr view`, `gh pr diff`). No direct GitHub API calls.
