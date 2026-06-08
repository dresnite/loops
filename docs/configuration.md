# Configuration

## Storage layout

Loops stores all state globally under `~/.loops/`:

```text
~/.loops/
├── credentials.json
├── definitions/
│   └── structure-agent.json
├── runs/
│   └── a1b2c3d4.json
└── logs/
    └── a1b2c3d4.log
```

Run logs are append-only text files written by the worker. Each line is timestamped and includes task progress, tool calls, assistant snippets, errors, and limit events.

### Credentials schema

```json
{
  "cursor": "cursor_...",
  "updatedAt": "2026-06-08T12:00:00.000Z"
}
```

Set with `loops key set cursor <your-key>`. The file is written with mode `600`.

### Loop definition schema

```json
{
  "name": "structure-agent",
  "description": "Improve codebase structure",
  "defaultPrompt": "Improve project structure",
  "defaultPreset": "./prompts/structure-agent.md",
  "provider": "cursor",
  "createdAt": "2026-06-08T12:00:00.000Z",
  "updatedAt": "2026-06-08T12:00:00.000Z"
}
```

### Run record schema

```json
{
  "id": "a1b2c3d4",
  "loopName": "structure-agent",
  "provider": "cursor",
  "repoPath": "/Users/me/projects/my-app",
  "prompt": "Improve project structure",
  "status": "running",
  "continuous": true,
  "pid": 12345,
  "limits": { "budgetUsd": 10, "maxTasks": 25 },
  "tasksCompleted": 7,
  "usage": {
    "inputTokens": 12000,
    "outputTokens": 4000,
    "cacheReadTokens": 0,
    "cacheWriteTokens": 0
  },
  "estimatedCostUsd": 3.096,
  "startedAt": "2026-06-08T12:00:00.000Z",
  "updatedAt": "2026-06-08T12:05:00.000Z"
}
```

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `CURSOR_API_KEY` | No | Optional override for stored Cursor key |
| `LOOPS_TEST_MODE` | No | Internal test flag; uses mock provider and skips worker spawn |

If no stored key and no `CURSOR_API_KEY` env var, `loops run` fails with:

```text
Cursor API key not configured.
Run: loops key set cursor <your-key>
Get a key at: https://cursor.com/dashboard/integrations
```

## Budget estimation

The Cursor SDK reports token usage per agent turn, not dollar amounts. Loops estimates cost using configurable per-million-token rates:

| Token type | Default rate (USD / 1M tokens) |
| --- | --- |
| Input | $3.00 |
| Output | $15.00 |
| Cache read | $0.75 |
| Cache write | $3.75 |

These rates are approximate. Actual billing follows your Cursor plan and appears in the team usage dashboard under the SDK tag.

`loops ls` shows budget usage as a percentage of your `--budget` limit based on this estimate.

## Task limits

One **task** equals one completed agent turn (one `send` → `wait` cycle). Tool calls within a turn count as part of that single task.

When `--tasks` is reached, the worker marks the run as `finished` and exits.

## Programmatic API

Loops exports a small library surface for tooling and tests:

```typescript
import {
  addLoop,
  startRun,
  listRuns,
  stopRun,
  getStoragePaths,
  setProviderKey,
  requireCursorApiKey,
} from "@dresnite/loops";
```

See TypeScript definitions in `dist/index.d.mts` after building.
