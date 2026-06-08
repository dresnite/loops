import { DEFAULT_MODEL } from "../../src/constants.js";
import { createEmptyUsage } from "../../src/core/limits.js";
import type { LoopRun } from "../../src/types.js";

export function makeTestRun(overrides: Partial<LoopRun> = {}): LoopRun {
  return {
    id: "deadbeef",
    loopName: "loops-improvement",
    provider: "cursor",
    model: DEFAULT_MODEL,
    repoPath: "/repo",
    prompt: "prompt",
    status: "running",
    continuous: true,
    limits: {},
    tasksCompleted: 0,
    usage: createEmptyUsage(),
    estimatedCostUsd: 0,
    startedAt: "2026-06-08T15:11:08.321Z",
    updatedAt: "2026-06-08T15:11:13.828Z",
    ...overrides,
  };
}
