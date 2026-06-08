import { Agent, CursorAgentError, type Run } from "@cursor/sdk";
import { DEFAULT_MODEL } from "../constants.js";
import { requireCursorApiKey } from "../core/credentials.js";
import type {
  AgentProvider,
  AgentRun,
  AgentSession,
  RunResult,
  SendHookOptions,
  SessionOptions,
  StreamEvent,
} from "./types.js";

class CursorAgentRun implements AgentRun {
  constructor(private readonly run: Run) {}

  get id(): string {
    return this.run.id;
  }

  async *stream(): AsyncGenerator<StreamEvent> {
    for await (const event of this.run.stream()) {
      if (event.type === "assistant") {
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            yield { type: "assistant", text: block.text };
          }
        }
        continue;
      }

      if (event.type === "tool_call") {
        yield { type: "tool_call", toolName: event.name };
        continue;
      }

      yield { type: event.type };
    }
  }

  async wait(): Promise<RunResult> {
    const result = await this.run.wait();
    return {
      id: result.id,
      status: result.status,
      result: result.result,
    };
  }

  async cancel(): Promise<void> {
    if (this.run.supports("cancel")) {
      await this.run.cancel();
    }
  }
}

class CursorAgentSession implements AgentSession {
  constructor(private readonly agent: Awaited<ReturnType<typeof Agent.create>>) {}

  get agentId(): string {
    return this.agent.agentId;
  }

  async send(prompt: string, options?: SendHookOptions): Promise<AgentRun> {
    const run = await this.agent.send(prompt, {
      onDelta: ({ update }) => {
        if (update.type === "turn-ended" && update.usage && options?.onUsage) {
          options.onUsage({
            inputTokens: update.usage.inputTokens,
            outputTokens: update.usage.outputTokens,
            cacheReadTokens: update.usage.cacheReadTokens,
            cacheWriteTokens: update.usage.cacheWriteTokens,
          });
        }

        if (update.type === "token-delta" && options?.onUsage) {
          options.onUsage({
            inputTokens: 0,
            outputTokens: update.tokens,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          });
        }
      },
    });

    return new CursorAgentRun(run);
  }

  async dispose(): Promise<void> {
    await this.agent[Symbol.asyncDispose]();
  }
}

async function resolveApiKey(explicit?: string): Promise<string> {
  if (explicit) {
    return explicit;
  }

  return requireCursorApiKey();
}

export class CursorProvider implements AgentProvider {
  readonly id = "cursor" as const;

  async createSession(options: SessionOptions): Promise<AgentSession> {
    try {
      const agent = await Agent.create({
        apiKey: options.apiKey ?? (await resolveApiKey()),
        model: { id: options.model ?? DEFAULT_MODEL },
        local: { cwd: options.repoPath },
      });
      return new CursorAgentSession(agent);
    } catch (error) {
      if (error instanceof CursorAgentError) {
        throw new Error(`startup failed: ${error.message}`, { cause: error });
      }
      throw error;
    }
  }

  async resumeSession(
    agentId: string,
    options: SessionOptions,
  ): Promise<AgentSession> {
    try {
      const agent = await Agent.resume(agentId, {
        apiKey: options.apiKey ?? (await resolveApiKey()),
        model: { id: options.model ?? DEFAULT_MODEL },
        local: { cwd: options.repoPath },
      });
      return new CursorAgentSession(agent);
    } catch (error) {
      if (error instanceof CursorAgentError) {
        throw new Error(`startup failed: ${error.message}`, { cause: error });
      }
      throw error;
    }
  }
}
