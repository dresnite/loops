import type { ProviderId } from "../constants.js";
import type { TokenUsage } from "../types.js";

export type RunResultStatus = "finished" | "error" | "cancelled";

export interface StreamEvent {
  type: string;
  usage?: TokenUsage;
  toolName?: string;
  text?: string;
}

export interface RunResult {
  id: string;
  status: RunResultStatus;
  result?: string;
}

export interface SessionOptions {
  repoPath: string;
  apiKey?: string;
  model?: string;
}

export interface AgentRun {
  readonly id: string;
  stream(): AsyncGenerator<StreamEvent>;
  wait(): Promise<RunResult>;
  cancel(): Promise<void>;
}

export interface SendHookOptions {
  onUsage?: (usage: TokenUsage) => void;
}

export interface AgentSession {
  readonly agentId: string;
  send(prompt: string, options?: SendHookOptions): Promise<AgentRun>;
  dispose(): Promise<void>;
}

export interface AgentProvider {
  readonly id: ProviderId;
  createSession(options: SessionOptions): Promise<AgentSession>;
  resumeSession(agentId: string, options: SessionOptions): Promise<AgentSession>;
}
