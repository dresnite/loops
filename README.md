# Loops

**Reusable AI workflows for your codebase.**

Loops turns ad-hoc agent prompts into durable, repeatable workflows. Define a loop once, run it on any repo, monitor active runs, and stop them like processes.

> **Providers:** [Cursor SDK](https://cursor.com/docs/sdk/typescript) today — Claude Code coming soon. See [docs/providers.md](docs/providers.md).

## Install

```bash
npm install -g @dresnite/loops
```

Or run without installing:

```bash
npx @dresnite/loops --help
```

## Quick start

```bash
# 1. Save your Cursor API key
loops key set cursor cursor_...

# 2. Define a loop
loops add structure-agent --prompt "Improve project structure"

# 3. Run it on a repo (continuous by default)
#    --model composer-2.5  → standard tier (default; use composer-2.5-fast for faster inference)
#    --budget 10           → stop after ~$10 estimated model spend
#    --tasks 25            → stop after 25 agent turns
loops run structure-agent --repo ./my-app --budget 10 --tasks 25

# 4. Check what's running (or see failed runs)
loops ls
loops ls --all

# 5. See what a loop is doing
loops logs structure-agent
loops logs structure-agent --follow
loops prompt show structure-agent
loops prompt set structure-agent --prompt "focus on tests next"

# 6. Stop a run (by name or run-id)
loops stop structure-agent
loops stop a1b2

# 7. Remove the definition
loops rm structure-agent
```

`--budget` and `--tasks` are optional guardrails. Use either, both, or neither. Without limits, a continuous run keeps going until you stop it.

## Commands

| Command                      | Description                  |
| ---------------------------- | ---------------------------- |
| `loops key set cursor <key>` | Save your Cursor API key     |
| `loops key list`             | List configured keys         |
| `loops add <name>`           | Create a loop definition     |
| `loops run <name>`           | Start a loop on a repository |
| `loops ls`                   | List running loops           |
| `loops ls --all`             | List recent runs (incl. failed) |
| `loops logs <name>`          | View logs for a loop run     |
| `loops prompt show <name>`   | View the prompt for a run    |
| `loops prompt set <name>`    | Update the prompt for a run  |
| `loops stop <name\|run-id>`  | Stop a running loop          |
| `loops rm <name>`            | Delete a loop definition     |

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

## Projects using Loops

Projects using Loops to run continuous AI workflows on their codebases:

- **[Animoo](https://animoo.ai)** — AI manga creation app. Runs Loops to improve stability, harden the codebase, and keep the product reliable as it evolves.

## Support

If Loops is useful to you, one way to support its development is to buy a [Cursor plan through my referral link](https://cursor.com/referral?code=KRPQKTMQIZAY). That gives me extra tokens to keep burning on real Loops runs.

I'm not paid or sponsored to post that link here — it's just my personal referral code, and you're supporting the tool's author, not a brand deal.

## License

Copyright (c) 2026 Andres Arias

Licensed under the MIT License. See [LICENSE](LICENSE) for the full text.
