import { describe, expect, it } from "vitest";
import { resolveRunTarget, RunNotFoundError } from "../../src/core/resolve.js";
import { makeTestRun } from "../helpers/make-run.js";

describe("resolveRunTarget", () => {
  it("resolves by run id prefix", () => {
    const run = resolveRunTarget("a1b2", [
      makeTestRun({ id: "a1b2c3d4" }),
      makeTestRun({ id: "ffff0000", loopName: "other" }),
    ]);

    expect(run.id).toBe("a1b2c3d4");
  });

  it("resolves active run by loop name for stop", () => {
    const run = resolveRunTarget(
      "structure-agent",
      [
        makeTestRun({
          id: "a1b2c3d4",
          loopName: "structure-agent",
          status: "running",
        }),
      ],
      { activeOnly: true },
    );

    expect(run.id).toBe("a1b2c3d4");
  });

  it("resolves latest run by loop name for logs", () => {
    const run = resolveRunTarget("structure-agent", [
      makeTestRun({
        id: "older000",
        loopName: "structure-agent",
        status: "finished",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      makeTestRun({
        id: "newer111",
        loopName: "structure-agent",
        status: "error",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
    ]);

    expect(run.id).toBe("newer111");
  });

  it("throws RunNotFoundError when no run matches", () => {
    try {
      resolveRunTarget("missing", [makeTestRun({ id: "a1b2c3d4" })]);
      throw new Error("expected RunNotFoundError");
    } catch (error) {
      expect(error).toBeInstanceOf(RunNotFoundError);
      expect((error as RunNotFoundError).target).toBe("missing");
    }
  });

  it("throws when loop name is ambiguous for active runs", () => {
    expect(() =>
      resolveRunTarget(
        "structure-agent",
        [
          makeTestRun({
            id: "run00001",
            loopName: "structure-agent",
            status: "running",
          }),
          makeTestRun({
            id: "run00002",
            loopName: "structure-agent",
            status: "running",
          }),
        ],
        { activeOnly: true },
      ),
    ).toThrow('Ambiguous loop "structure-agent"');
  });
});
