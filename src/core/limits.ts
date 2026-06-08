import { getModelTokenRates } from "./model-pricing.js";
import type { LoopRunLimits, TokenUsage } from "../types.js";

export function createEmptyUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

export function mergeUsage(current: TokenUsage, delta: TokenUsage): TokenUsage {
  return {
    inputTokens: current.inputTokens + delta.inputTokens,
    outputTokens: current.outputTokens + delta.outputTokens,
    cacheReadTokens: current.cacheReadTokens + delta.cacheReadTokens,
    cacheWriteTokens: current.cacheWriteTokens + delta.cacheWriteTokens,
  };
}

export function estimateCostUsd(usage: TokenUsage, model?: string): number {
  const rates = getModelTokenRates(model);
  const inputCost = (usage.inputTokens / 1_000_000) * rates.input;
  const outputCost = (usage.outputTokens / 1_000_000) * rates.output;
  const cacheReadCost =
    (usage.cacheReadTokens / 1_000_000) * rates.cacheRead;
  const cacheWriteCost =
    (usage.cacheWriteTokens / 1_000_000) * rates.cacheWrite;

  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

export function budgetPercentUsed(
  estimatedCostUsd: number,
  budgetUsd?: number,
): number | undefined {
  if (budgetUsd === undefined || budgetUsd <= 0) {
    return undefined;
  }

  return Math.min(100, Math.round((estimatedCostUsd / budgetUsd) * 100));
}

export function shouldStopForLimits(
  tasksCompleted: number,
  estimatedCostUsd: number,
  limits: LoopRunLimits,
): boolean {
  if (limits.maxTasks !== undefined && tasksCompleted >= limits.maxTasks) {
    return true;
  }

  if (
    limits.budgetUsd !== undefined &&
    estimatedCostUsd >= limits.budgetUsd
  ) {
    return true;
  }

  return false;
}
