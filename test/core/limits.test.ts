import { describe, expect, it } from "vitest";
import {
  budgetPercentUsed,
  estimateCostUsd,
  mergeUsage,
  shouldStopForLimits,
} from "../../src/core/limits.js";

describe("limits", () => {
  it("merges token usage", () => {
    const merged = mergeUsage(
      {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 10,
        cacheWriteTokens: 5,
      },
      {
        inputTokens: 20,
        outputTokens: 10,
        cacheReadTokens: 2,
        cacheWriteTokens: 1,
      },
    );

    expect(merged).toEqual({
      inputTokens: 120,
      outputTokens: 60,
      cacheReadTokens: 12,
      cacheWriteTokens: 6,
    });
  });

  it("estimates cost from usage", () => {
    const cost = estimateCostUsd({
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });

    expect(cost).toBe(3);
  });

  it("calculates budget percent", () => {
    expect(budgetPercentUsed(2.5, 10)).toBe(25);
    expect(budgetPercentUsed(12, 10)).toBe(100);
  });

  it("stops when task or budget limits are reached", () => {
    expect(
      shouldStopForLimits(20, 1, { maxTasks: 20, budgetUsd: 10 }),
    ).toBe(true);
    expect(
      shouldStopForLimits(5, 10, { maxTasks: 20, budgetUsd: 10 }),
    ).toBe(true);
    expect(
      shouldStopForLimits(5, 1, { maxTasks: 20, budgetUsd: 10 }),
    ).toBe(false);
  });
});
