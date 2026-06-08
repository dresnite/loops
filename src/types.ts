import type { ProviderId } from "./constants.js";

export type RunStatus =
  | "starting"
  | "running"
  | "stopped"
  | "finished"
  | "error";

export interface LoopDefinition {
  name: string;
  description?: string;
  defaultPrompt?: string;
  defaultPreset?: string;
  defaultModel?: string;
  provider: ProviderId;
  createdAt: string;
  updatedAt: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface LoopRunLimits {
  budgetUsd?: number;
  maxTasks?: number;
}

export interface LoopRun {
  id: string;
  loopName: string;
  provider: ProviderId;
  model: string;
  repoPath: string;
  prompt: string;
  presetPath?: string;
  status: RunStatus;
  continuous: boolean;
  pid?: number;
  agentId?: string;
  currentRunId?: string;
  limits: LoopRunLimits;
  tasksCompleted: number;
  usage: TokenUsage;
  estimatedCostUsd: number;
  startedAt: string;
  updatedAt: string;
  error?: string;
}

export interface CreateLoopInput {
  name: string;
  description?: string;
  defaultPrompt?: string;
  defaultPreset?: string;
  defaultModel?: string;
  provider?: ProviderId;
}

export interface StartRunInput {
  loopName: string;
  repoPath: string;
  prompt?: string;
  presetPath?: string;
  model?: string;
  provider?: ProviderId;
  budgetUsd?: number;
  maxTasks?: number;
  once?: boolean;
}

export interface ResolvedPrompt {
  text: string;
  presetPath?: string;
}
