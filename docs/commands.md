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
loops add structure-agent --interactive
```

| Flag | Description |
| --- | --- |
| `--description`, `-d` | Human-readable description |
| `--prompt` | Default inline prompt |
| `--preset` | Default preset file path |
| `--interactive` | Prompt for optional fields |

Fails if a definition with the same name already exists.

## `loops run <name>`

Start a loop on a repository.

```bash
loops run structure-agent --repo ./my-app
loops run structure-agent --repo ./my-app --prompt "fix all lint issues"
loops run structure-agent --repo ./my-app --preset ./prompts/structure-agent.md
loops run structure-agent --repo ./my-app --budget 10 --tasks 25
loops run structure-agent --repo ./my-app --once
```

| Flag | Description |
| --- | --- |
| `--repo` | Repository path (default: current directory) |
| `--preset` | Preset instruction file for this run |
| `--prompt` | Inline instruction for this run |
| `--budget` | Maximum estimated spend in USD; stops the run when reached |
| `--tasks` | Maximum number of agent turns; stops the run when reached |
| `--once` | Run once and exit |
| `--provider` | Agent provider (default: `cursor`) |

Prints the run id on success:

```text
Started loop "structure-agent" (run-id: a1b2c3d4)
```

## `loops ls`

List all currently running loops.

```bash
loops ls
```

Example output:

```text
structure-agent → running (run-id: a1b2, budget used: 30%, tasks: 7/25)
tests → running (run-id: c3d4)
```

Shows budget percentage and task progress when limits are set.

## `loops stop <run-id>`

Stop an active loop run.

```bash
loops stop a1b2c3d4
loops stop a1b2
```

Accepts a full run id or a unique prefix. Sends `SIGTERM` to the worker process and marks the run as `stopped`.

## `loops rm <name>`

Delete a loop definition permanently.

```bash
loops rm structure-agent
```

Refuses to delete if any run for that loop name is still active. Stop runs first with `loops stop`.

## Global behavior

Running `loops` with no subcommand prints the provider roadmap:

```text
Providers: cursor (planned: claude-code)
```
