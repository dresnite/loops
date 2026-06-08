# Commands

Full reference for the Loops CLI.

## `loops key`

Manage provider API keys stored in `~/.loops/credentials.json`.

### `loops key set <provider> <api-key>`

Save an API key for a provider.

```bash
loops key set cursor cursor_...
```

| Argument | Description |
| --- | --- |
| `provider` | Provider id (`cursor`) |
| `api-key` | Your API key |

### `loops key list`

List configured keys with masked values.

```bash
loops key list
```

Example output:

```text
cursor: cursor...1234 (stored)
```

If `CURSOR_API_KEY` is set, it is shown as an env override.

## `loops add <name>`

Create a new loop definition.

```bash
loops add structure-agent
loops add structure-agent --description "Improve codebase structure"
loops add structure-agent --prompt "Improve project structure"
loops add structure-agent --preset ./prompts/structure-agent.md
loops add structure-agent --model gpt-5.2
loops add structure-agent --interactive
```

| Flag | Description |
| --- | --- |
| `--description`, `-d` | Human-readable description |
| `--prompt` | Default inline prompt |
| `--preset` | Default preset file path |
| `--model` | Default agent model (default: `composer-2.5`) |
| `--interactive` | Prompt for optional fields |

Fails if a definition with the same name already exists.

## `loops run <name>`

Start a loop on a repository.

```bash
loops run structure-agent --repo ./my-app
loops run structure-agent --repo ./my-app --prompt "fix all lint issues"
loops run structure-agent --repo ./my-app --preset ./prompts/structure-agent.md
loops run structure-agent --repo ./my-app --budget 10 --tasks 25
loops run structure-agent --repo ./my-app --model composer-2.5-fast
loops run structure-agent --repo ./my-app --once
```

| Flag | Description |
| --- | --- |
| `--repo` | Repository path (default: current directory) |
| `--preset` | Preset instruction file for this run |
| `--prompt` | Inline instruction for this run |
| `--model` | Agent model for this run (overrides definition default; default: `composer-2.5`) |
| `--budget` | Maximum estimated spend in USD; stops the run when reached |
| `--tasks` | Maximum number of agent turns; stops the run when reached |
| `--once` | Run once and exit |
| `--provider` | Agent provider (default: `cursor`) |

Prints the run id on success:

```text
Started loop "structure-agent" (run-id: a1b2c3d4)
```

## `loops ls`

List currently running loops.

```bash
loops ls
loops ls --all
```

| Flag | Description |
| --- | --- |
| `--all`, `-a` | Show recent runs (all statuses, up to 20) |

Example output:

```text
structure-agent → running (run-id: a1b2, model: composer-2.5, budget used: 30%, tasks: 7/25)
structure-agent → error (run-id: c3d4, tasks: 3/25, error: startup failed: ...)
```

Shows budget percentage, task progress, and error snippets when relevant.

## `loops prompt`

View or update the prompt for a loop run.

### `loops prompt show <name|run-id>`

Show the resolved prompt and run metadata.

```bash
loops prompt show structure-agent
loops prompt show a1b2c3d4
```

Example output:

```text
Run a1b2c3d4 (structure-agent) — status: running
Model: composer-2.5
Repo: /path/to/my-app
---
Improve project structure
```

When the run used a preset file, `Preset: <path>` appears above the separator.

### `loops prompt set <name|run-id>`

Update the prompt stored on the run record.

```bash
loops prompt set structure-agent --prompt "fix all lint issues"
loops prompt set a1b2c3d4 --preset ./prompts/structure-agent.md
```

| Flag | Description |
| --- | --- |
| `--prompt` | Inline prompt text (clears any stored preset path) |
| `--preset` | Preset file path, resolved relative to the run's `--repo` |

Provide exactly one of `--prompt` or `--preset`. For an active continuous run, the worker picks up the new prompt on the next task.

## `loops logs <name|run-id>`

View logs for a loop run. Resolves the latest run when given a loop name.

```bash
loops logs structure-agent
loops logs structure-agent --follow
loops logs a1b2c3d4 --lines 100
```

| Flag | Description |
| --- | --- |
| `--follow`, `-f` | Follow log output live |
| `--lines`, `-n` | Number of lines to show (default: 50) |

Example output:

```text
Run a1b2c3d4 (structure-agent) — status: error
Error: startup failed: ...
---
2026-06-08T12:00:00.000Z [start] loop=structure-agent repo=/path
2026-06-08T12:00:01.000Z [task 1] sending prompt
2026-06-08T12:00:05.000Z [tool] read
2026-06-08T12:00:10.000Z [task 1] error: startup failed: ...
```

## `loops stop <name|run-id>`

Stop an active loop run.

```bash
loops stop structure-agent
loops stop a1b2c3d4
loops stop a1b2
```

Accepts a loop name (when only one active run exists), a full run id, or a unique prefix. Sends `SIGTERM` to the worker process and marks the run as `stopped`.

## `loops rm <name>`

Delete a loop definition permanently.

```bash
loops rm structure-agent
```

Refuses to delete if any run for that loop name is still active. Stop runs first with `loops stop`.

## Global behavior

Running `loops --help` includes the provider roadmap in the description (`cursor` supported, `claude-code` planned).
