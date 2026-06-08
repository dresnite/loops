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
  ) {
    this.agentId = `mock-agent-${nextAgentId++}`;
  }

  async send(_prompt: string, options?: SendHookOptions): Promise<AgentRun> {
    const behavior = this.behaviors[this.runIndex] ?? {};
    this.runIndex += 1;

    if (behavior.usage) {
      options?.onUsage?.(behavior.usage);
    }

    return new MockAgentRun(`mock-run-${nextRunId++}`, behavior);
  }

  async dispose(): Promise<void> {}
}

export class MockProvider implements AgentProvider {
  readonly id: ProviderId = "cursor";
  private readonly options: MockProviderOptions;

  constructor(options: MockProviderOptions = {}) {
    this.options = options;
  }

  async createSession(_options: SessionOptions): Promise<AgentSession> {
    if (this.options.failCreate) {
      throw new Error("startup failed: mock provider failure");
    }

    return new MockAgentSession(this.options.runs ?? [{}]);
  }

  async resumeSession(
    agentId: string,
    _options: SessionOptions,
  ): Promise<AgentSession> {
    const session = new MockAgentSession(this.options.runs ?? [{}]);
    Object.defineProperty(session, "agentId", { value: agentId });
    return session;
  }
}

export function resetMockProviderIds(): void {
  nextAgentId = 1;
  nextRunId = 1;
}
