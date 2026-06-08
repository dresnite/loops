import {
  resetProcessAliveCheckerForTesting,
  setProcessAliveCheckerForTesting,
} from "../../src/core/process.js";
import {
  resetWorkerSpawnerForTesting,
  setWorkerSpawnerForTesting,
  type WorkerSpawner,
} from "../../src/core/runner.js";
import { resetWriteQueuesForTesting } from "../../src/core/storage.js";

export interface TestRuntimeOptions {
  processAlive?: boolean | ((pid: number) => boolean);
  workerPid?: number;
  workerSpawner?: WorkerSpawner;
}

export function setupTestRuntime(options: TestRuntimeOptions = {}): void {
  const { processAlive = true, workerPid = 4242, workerSpawner } = options;

  if (typeof processAlive === "function") {
    setProcessAliveCheckerForTesting(processAlive);
  } else {
    setProcessAliveCheckerForTesting(() => processAlive);
  }

  setWorkerSpawnerForTesting(
    workerSpawner ?? (() => ({ pid: workerPid })),
  );
}

export function resetTestRuntime(): void {
  resetProcessAliveCheckerForTesting();
  resetWorkerSpawnerForTesting();
  resetWriteQueuesForTesting();
}
