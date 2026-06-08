import { describe, expect, it } from "vitest";
import {
  isWorkerExitedError,
  reconcileRunState,
  shouldReconcileRun,
  WORKER_EXITED_UNEXPECTEDLY,
} from "../../src/core/process.js";
import { makeTestRun } from "../helpers/make-run.js";
import { setupTestRuntime } from "../helpers/test-runtime.js";

describe("shouldReconcileRun", () => {
  it("requires an active run with a dead worker pid", () => {
    setupTestRuntime({ processAlive: false });

    expect(shouldReconcileRun(makeTestRun({ pid: 999_999 }))).toBe(true);
    expect(shouldReconcileRun(makeTestRun({ pid: undefined }))).toBe(false);
    expect(shouldReconcileRun(makeTestRun({ status: "stopped", pid: 999_999 }))).toBe(
      false,
    );
  });

  it("ignores active runs when the worker process is alive", () => {
    setupTestRuntime({ processAlive: true });

    expect(shouldReconcileRun(makeTestRun({ pid: 999_999 }))).toBe(false);
  });
});

describe("reconcileRunState", () => {
  it("marks dead worker processes as error", () => {
    setupTestRuntime({ processAlive: false });

    const reconciled = reconcileRunState(makeTestRun({ pid: 999_999 }));
    expect(reconciled.status).toBe("error");
    expect(reconciled.error).toBe(WORKER_EXITED_UNEXPECTEDLY);
    expect(reconciled.pid).toBeUndefined();
  });

  it("returns the same run when no reconciliation is needed", () => {
    setupTestRuntime({ processAlive: true });

    const run = makeTestRun({ pid: 999_999 });
    expect(reconcileRunState(run)).toBe(run);
  });
});

describe("isWorkerExitedError", () => {
  it("matches reconciled zombie runs", () => {
    expect(
      isWorkerExitedError(
        makeTestRun({
          status: "error",
          error: WORKER_EXITED_UNEXPECTEDLY,
        }),
      ),
    ).toBe(true);
  });

  it("rejects other error states", () => {
    expect(
      isWorkerExitedError(
        makeTestRun({
          status: "error",
          error: "startup failed: boom",
        }),
      ),
    ).toBe(false);
    expect(isWorkerExitedError(makeTestRun({ status: "stopped" }))).toBe(false);
  });
});
