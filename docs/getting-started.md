# Getting started

This guide walks you through installing Loops, saving your Cursor API key, and running your first workflow.

## Prerequisites

- Node.js 20 or later
- A [Cursor API key](https://cursor.com/dashboard/integrations)

## Install

```bash
npm install -g @dresnite/loops
```

Verify the install:

```bash
loops --help
```

Help output includes the provider roadmap (`cursor` supported, `claude-code` planned).

## Authenticate

Save your Cursor API key once. Loops stores it in `~/.loops/credentials.json` (file mode `600`).

```bash
loops key set cursor cursor_...
```

Confirm it was saved:

```bash
loops key list
```

Service account keys from Cursor Team settings also work.

`CURSOR_API_KEY` still works as an override, but the recommended flow is `loops key set`.

## Define your first loop

```bash
loops add structure-agent --description "Improve codebase structure"
```

For interactive setup:

```bash
loops add structure-agent --interactive
```

Definitions are stored globally in `~/.loops/definitions/`.

## Run the loop

Start a continuous run against a repository:

```bash
loops run structure-agent \
  --repo ./my-app \
  --prompt "improve structure" \
  --budget 10 \
  --tasks 25
```

The command prints a run id and returns immediately. The worker keeps running in the background.

### Budget and tasks

| Flag | Meaning |
| --- | --- |
| `--budget <usd>` | Stop when estimated model spend reaches this dollar amount |
| `--tasks <n>` | Stop after this many completed agent turns |

Both are optional. Examples:

- `--budget 10` only — spend cap, no turn limit
- `--tasks 25` only — stop after 25 turns, no spend cap
- `--budget 10 --tasks 25` — stop when either limit is hit first
- neither — run continuously until you stop it with `loops stop`

Budget is estimated from token usage reported by the Cursor SDK. See [Configuration](configuration.md) for details.

For a single execution:

```bash
loops run structure-agent --repo ./my-app --once
```

## Monitor and stop

```bash
loops ls
```

Example output:

```text
structure-agent → running (run-id: a1b2, budget used: 30%, tasks: 7/25)
```

### Check if a loop failed

Active runs disappear from `loops ls` when they finish or error. Use:

```bash
loops ls --all
loops logs structure-agent
```

Failed runs show `status: error` with an error snippet. `loops logs` prints the full activity log.

### Follow a running loop

```bash
loops logs structure-agent --follow
```

### View or change the prompt

```bash
loops prompt show structure-agent
loops prompt set structure-agent --prompt "focus on error handling"
```

On a continuous run, prompt changes apply on the next agent task.

Stop by loop name or run id:

```bash
loops stop structure-agent
loops stop a1b2
```

## Clean up

```bash
loops rm structure-agent
```

You cannot remove a definition while a run for that loop is still active.

## Next steps

- Read [Concepts](concepts.md) to understand definitions vs runs
- See [Commands](commands.md) for the full flag reference
- Configure storage and limits in [Configuration](configuration.md)
