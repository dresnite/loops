import type { ProviderId } from "../constants.js";
import type {
  AgentProvider,
  AgentRun,
  AgentSession,
  RunResult,
  SendHookOptions,
  SessionOptions,
  StreamEvent,
} from "./types.js";

let nextAgentId = 1;
let nextRunId = 1;

export interface MockRunBehavior {
  status?: RunResult["status"];
  result?: string;
  usage?: StreamEvent["usage"];
  delayMs?: number;
  rapidUsageCalls?: number;
  assistantDeltas?: string[];
  toolCalls?: string[];
}

export interface MockProviderOptions {
  runs?: MockRunBehavior[];
  failCreate?: boolean;
}

class MockAgentRun implements AgentRun {
  private cancelled = false;

  constructor(
    readonly id: string,
    private readonly behavior: MockRunBehavior,
  ) {}

  async *stream(): AsyncGenerator<StreamEvent> {
    if (this.behavior.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.behavior.delayMs));
    }

    if (this.behavior.usage) {
      yield { type: "turn-ended", usage: this.behavior.usage };
    }

    for (const delta of this.behavior.assistantDeltas ?? []) {
      yield { type: "assistant", text: delta };
    }

    for (const toolName of this.behavior.toolCalls ?? []) {
      yield { type: "tool_call", toolName };
    }
  }

  async wait(): Promise<RunResult> {
    if (this.cancelled) {
      return { id: this.id, status: "cancelled" };
    }

    if (this.behavior.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.behavior.delayMs));
    }

    return {
      id: this.id,
      status: this.behavior.status ?? "finished",
      result: this.behavior.result ?? "mock result",
    };
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
  }
}

class MockAgentSession implements AgentSession {
  readonly agentId: string;
  private runIndex = 0;

  constructor(
    private readonly behaviors: MockRunBehavior[],
    private readonly hooks?: { onSend?: (prompt: string) => void },
  ) {
    this.agentId = `mock-agent-${nextAgentId++}`;
  }

  async send(prompt: string, options?: SendHookOptions): Promise<AgentRun> {
    this.hooks?.onSend?.(prompt);
    const behavior = this.behaviors[this.runIndex] ?? {};
    this.runIndex += 1;

    if (behavior.usage) {
      options?.onUsage?.(behavior.usage);
    }

    if (behavior.rapidUsageCalls) {
      for (let index = 0; index < behavior.rapidUsageCalls; index += 1) {
        options?.onUsage?.({
          inputTokens: 0,
          outputTokens: 1,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        });
      }
    }

    return new MockAgentRun(`mock-run-${nextRunId++}`, behavior);
  }

  async dispose(): Promise<void> {}
}

export class MockProvider implements AgentProvider {
  readonly id: ProviderId = "cursor";
  private readonly options: MockProviderOptions;
  lastSessionOptions: SessionOptions | undefined;
  lastSession: MockAgentSession | undefined;
  readonly sentPrompts: string[] = [];

  constructor(options: MockProviderOptions = {}) {
    this.options = options;
  }

  async createSession(options: SessionOptions): Promise<AgentSession> {
    this.lastSessionOptions = options;

    if (this.options.failCreate) {
      throw new Error("startup failed: mock provider failure");
    }

    const provider = this;
    const session = new MockAgentSession(this.options.runs ?? [{}], {
      onSend(prompt: string) {
        provider.sentPrompts.push(prompt);
      },
    });
    this.lastSession = session;
    return session;
  }

  async resumeSession(
    agentId: string,
    _options: SessionOptions,
  ): Promise<AgentSession> {
    const provider = this;
    const session = new MockAgentSession(this.options.runs ?? [{}], {
      onSend(prompt: string) {
        provider.sentPrompts.push(prompt);
      },
    });
    Object.defineProperty(session, "agentId", { value: agentId });
    return session;
  }
}

export function resetMockProviderIds(): void {
  nextAgentId = 1;
  nextRunId = 1;
}
