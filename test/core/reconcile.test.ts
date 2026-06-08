import { afterEach, describe, expect, it } from "vitest";
import { WORKER_EXITED_UNEXPECTEDLY } from "../../src/core/process.js";
import {
  getRun,
  listRuns,
  runStatePath,
  saveRun,
  stopRun,
} from "../../src/core/runner.js";
import { getStoragePaths, readJson } from "../../src/core/storage.js";
import type { LoopRun } from "../../src/types.js";
import { makeTestRun } from "../helpers/make-run.js";
import { createTempHome } from "../helpers/temp-home.js";
import { setupTestRuntime } from "../helpers/test-runtime.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("reconcileRun persistence", () => {
  it("reconciles zombie runs when listing and getting runs", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    setupTestRuntime({ processAlive: false });

    const paths = getStoragePaths(homeDir);
    await saveRun(makeTestRun({ pid: 999_999 }), paths);

    const listed = await listRuns(paths);
    expect(listed[0]?.status).toBe("error");

    const loaded = await getRun("deadbeef", paths);
    expect(loaded?.status).toBe("error");
    expect(loaded?.error).toBe(WORKER_EXITED_UNEXPECTEDLY);
  });

  it("stops reconciled zombie runs by loop name", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    setupTestRuntime({ processAlive: false });

    const paths = getStoragePaths(homeDir);
    await saveRun(makeTestRun({ pid: 999_999 }), paths);

    const stopped = await stopRun("loops-improvement", paths);
    expect(stopped.status).toBe("stopped");
    expect(stopped.error).toBeUndefined();

    const persisted = await readJson<LoopRun>(runStatePath(paths, "deadbeef"));
    expect(persisted?.status).toBe("stopped");
  });
});
