# Providers

Loops talks to AI agent backends through a provider abstraction. This keeps the CLI stable while new runtimes are added.

## Supported today

### Cursor SDK

Loops uses [`@cursor/sdk`](https://www.npmjs.com/package/@cursor/sdk) for local agent execution.

**Setup:**

```bash
loops key set cursor cursor_...
```

`CURSOR_API_KEY` still works as an env override, but storing the key with `loops key set` is the recommended flow.

**How it works:**

- `loops run` creates a local Cursor agent with `cwd` set to your `--repo` path
- The worker sends your prompt via `agent.send()` and streams results
- Continuous runs reuse the same agent for conversation continuity
- `loops stop` cancels the in-flight run and terminates the worker

**Default model:** `composer-2.5`

**Docs:** [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript)

Select Cursor explicitly (this is the default):

```bash
loops run structure-agent --repo ./my-app --provider cursor
```

If no key is configured, `loops run` fails before starting the worker.

## Planned

### Claude Code

Claude Code support is planned. The provider interface is already in place; a `ClaudeCodeProvider` will implement the same `AgentProvider` contract.

When available:

```bash
loops key set claude-code <your-key>
loops run structure-agent --repo ./my-app --provider claude-code
```

Trying a planned provider today returns a clear error:

```text
Provider "claude-code" is planned but not yet supported. Supported: cursor
```

## Provider roadmap

| Provider | Status | Notes |
| --- | --- | --- |
| Cursor SDK | Supported | `loops key set cursor <key>` |
| Claude Code | Planned | Same CLI surface, different backend |
| Cloud agents | Future | Cursor cloud runtime for detached/CI runs |

## Adding a provider

Providers implement:

```typescript
interface AgentProvider {
  readonly id: ProviderId;
  createSession(options: SessionOptions): Promise<AgentSession>;
  resumeSession(agentId: string, options: SessionOptions): Promise<AgentSession>;
}
```

New providers are registered in `src/providers/index.ts` and documented here.
