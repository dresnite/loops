# Loops

**Reusable AI workflows for your codebase.**

Loops turns ad-hoc agent prompts into durable, repeatable workflows. Define a loop once, run it on any repo, monitor active runs, and stop them like processes.

> **Providers:** [Cursor SDK](https://cursor.com/docs/sdk/typescript) today — Claude Code coming soon. See [docs/providers.md](docs/providers.md).

## Install

```bash
npm install -g loops
```

Or run without installing:

```bash
npx loops --help
```

## Quick start

```bash
# 1. Save your Cursor API key
loops key set cursor cursor_...

# 2. Define a loop
loops add structure-agent --prompt "Improve project structure"

# 3. Run it on a repo (continuous by default)
#    --budget 10  → stop after ~$10 estimated model spend
#    --tasks 25   → stop after 25 agent turns
loops run structure-agent --repo ./my-app --budget 10 --tasks 25

# 4. Check what's running
loops ls

# 5. Stop a run
loops stop a1b2

# 6. Remove the definition
loops rm structure-agent
```

`--budget` and `--tasks` are optional guardrails. Use either, both, or neither. Without limits, a continuous run keeps going until you stop it.

## Commands

| Command | Description |
| --- | --- |
| `loops key set cursor <key>` | Save your Cursor API key |
| `loops key list` | List configured keys |
| `loops add <name>` | Create a loop definition |
| `loops run <name>` | Start a loop on a repository |
| `loops ls` | List running loops |
| `loops stop <run-id>` | Stop a running loop |
| `loops rm <name>` | Delete a loop definition |

## Documentation

- [Getting started](docs/getting-started.md) — install, auth, and first workflow
- [Concepts](docs/concepts.md) — loop definitions, runs, and repo context
- [Commands](docs/commands.md) — full CLI reference
- [Configuration](docs/configuration.md) — storage, credentials, budget limits
- [Providers](docs/providers.md) — Cursor SDK setup and roadmap

## Why Loops?

Instead of running the same prompt manually every time, you get a workflow that:

- runs inside a repo
- follows a prompt or preset file
- runs continuously or once
- starts and stops like a process
- respects optional budget and task limits

## License

MIT
