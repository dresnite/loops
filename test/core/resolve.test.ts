import { describe, expect, it } from "vitest";
import { resolveRunTarget } from "../../src/core/resolve.js";
import type { LoopRun } from "../../src/types.js";

function makeRun(overrides: Partial<LoopRun>): LoopRun {
  return {
    id: "a1b2c3d4",
    loopName: "structure-agent",
    provider: "cursor",
    repoPath: "/repo",
    prompt: "prompt",
    status: "running",
    continuous: true,
    limits: {},
    tasksCompleted: 0,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    estimatedCostUsd: 0,
    startedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveRunTarget", () => {
  it("resolves by run id prefix", () => {
    const run = resolveRunTarget("a1b2", [
      makeRun({ id: "a1b2c3d4" }),
      makeRun({ id: "ffff0000", loopName: "other" }),
    ]);

    expect(run.id).toBe("a1b2c3d4");
  });

  it("resolves active run by loop name for stop", () => {
    const run = resolveRunTarget(
      "structure-agent",
      [makeRun({ id: "a1b2c3d4", status: "running" })],
      { activeOnly: true },
    );

    expect(run.id).toBe("a1b2c3d4");
  });

  it("resolves latest run by loop name for logs", () => {
    const run = resolveRunTarget("structure-agent", [
      makeRun({
        id: "older000",
        status: "finished",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      makeRun({
        id: "newer111",
        status: "error",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
    ]);

    expect(run.id).toBe("newer111");
  });

  it("throws when loop name is ambiguous for active runs", () => {
    expect(() =>
      resolveRunTarget(
        "structure-agent",
        [
          makeRun({ id: "run00001", status: "running" }),
          makeRun({ id: "run00002", status: "running" }),
        ],
        { activeOnly: true },
      ),
    ).toThrow('Ambiguous loop "structure-agent"');
  });
});
