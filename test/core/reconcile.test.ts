import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  reconcileRunState,
  setProcessAliveCheckerForTesting,
} from "../../src/core/process.js";
import {
  getRun,
  listRuns,
  saveRun,
  stopRun,
} from "../../src/core/runner.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { createEmptyUsage } from "../../src/core/limits.js";
import type { LoopRun } from "../../src/types.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

beforeEach(() => {
  setProcessAliveCheckerForTesting(null);
});

afterEach(async () => {
  setProcessAliveCheckerForTesting(null);
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

function makeZombieRun(overrides: Partial<LoopRun> = {}): LoopRun {
  return {
    id: "deadbeef",
    loopName: "loops-improvement",
    provider: "cursor",
    repoPath: "/repo",
    prompt: "prompt",
    status: "running",
    continuous: true,
    pid: 999_999,
    limits: { maxTasks: 25 },
    tasksCompleted: 0,
    usage: createEmptyUsage(),
    estimatedCostUsd: 0,
    startedAt: "2026-06-08T15:11:08.321Z",
    updatedAt: "2026-06-08T15:11:13.828Z",
    ...overrides,
  };
}

describe("reconcileRun", () => {
  it("marks dead worker processes as error", () => {
    setProcessAliveCheckerForTesting(() => false);

    const reconciled = reconcileRunState(makeZombieRun());
    expect(reconciled.status).toBe("error");
    expect(reconciled.error).toBe("worker process exited unexpectedly");
    expect(reconciled.pid).toBeUndefined();
  });

  it("reconciles zombie runs when listing and getting runs", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    setProcessAliveCheckerForTesting(() => false);

    const paths = getStoragePaths(homeDir);
    await saveRun(makeZombieRun(), paths);

    const listed = await listRuns(paths);
    expect(listed[0]?.status).toBe("error");

    const loaded = await getRun("deadbeef", paths);
    expect(loaded?.status).toBe("error");
    expect(loaded?.error).toBe("worker process exited unexpectedly");
  });

  it("stops reconciled zombie runs by loop name", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    setProcessAliveCheckerForTesting(() => false);

    const paths = getStoragePaths(homeDir);
    await saveRun(makeZombieRun(), paths);

    const stopped = await stopRun("loops-improvement", paths);
    expect(stopped.status).toBe("stopped");
    expect(stopped.error).toBeUndefined();

    const persisted = await readRun(paths, "deadbeef");
    expect(persisted?.status).toBe("stopped");
  });
});

async function readRun(
  paths: ReturnType<typeof getStoragePaths>,
  runId: string,
): Promise<LoopRun | null> {
  const { readJson } = await import("../../src/core/storage.js");
  return readJson<LoopRun>(join(paths.runs, `${runId}.json`));
}
