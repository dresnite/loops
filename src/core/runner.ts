import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "pathe";
import { randomBytes } from "node:crypto";
import { DEFAULT_PROVIDER } from "../constants.js";
import { assertSupportedProvider } from "../providers/index.js";
import type { LoopRun, StartRunInput } from "../types.js";
import { isErrnoCode } from "./errors.js";
import { createEmptyUsage } from "./limits.js";
import { assertValidModel, resolveRunModel } from "./models.js";
import { runLogPath } from "./logs.js";
import { getWorkerScriptPath } from "./paths.js";
import { isWorkerExitedError, reconcileRunState } from "./process.js";
import { resolvePrompt } from "./prompt.js";
import { resolveRunTarget, RunNotFoundError } from "./resolve.js";
import { isActiveRun } from "./run-state.js";
import { getLoop } from "./registry.js";
import {
  ensureStorageDirs,
  getStoragePaths,
  listJsonFiles,
  readJson,
  writeJsonAtomic,
  type StoragePaths,
} from "./storage.js";

export function runStatePath(paths: StoragePaths, runId: string): string {
  return join(paths.runs, `${runId}.json`);
}

function nowIso(): string {
  return new Date().toISOString();
}

function createRunId(): string {
  return randomBytes(4).toString("hex");
}

async function reconcileAndPersistRun(
  run: LoopRun,
  paths: StoragePaths,
): Promise<LoopRun> {
  const reconciled = reconcileRunState(run);
  if (reconciled === run) {
    return run;
  }

  await saveRun(reconciled, paths);
  return reconciled;
}

/** Reads persisted run state without reconciling worker process liveness. */
export async function readRunRaw(
  runId: string,
  paths = getStoragePaths(),
): Promise<LoopRun | null> {
  return readJson<LoopRun>(runStatePath(paths, runId));
}

export async function getRun(
  runId: string,
  paths = getStoragePaths(),
): Promise<LoopRun | null> {
  const run = await readRunRaw(runId, paths);
  if (!run) {
    return null;
  }

  return reconcileAndPersistRun(run, paths);
}

export async function saveRun(
  run: LoopRun,
  paths = getStoragePaths(),
): Promise<void> {
  await ensureStorageDirs(paths);
  run.updatedAt = nowIso();
  await writeJsonAtomic(runStatePath(paths, run.id), run);
}

export async function listRuns(
  paths = getStoragePaths(),
): Promise<LoopRun[]> {
  const files = await listJsonFiles(paths.runs);
  const runs = await Promise.all(
    files.map(async (file) => {
      const run = await readJson<LoopRun>(join(paths.runs, file));
      return run;
    }),
  );

  const resolved = await Promise.all(
    runs
      .filter((run): run is LoopRun => run !== null)
      .map((run) => reconcileAndPersistRun(run, paths)),
  );

  return resolved.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function listActiveRunsForLoop(
  loopName: string,
  paths = getStoragePaths(),
): Promise<LoopRun[]> {
  const runs = await listRuns(paths);
  return runs.filter((run) => run.loopName === loopName && isActiveRun(run));
}

export { resolveRunTarget } from "./resolve.js";

async function assertRepoExists(repoPath: string): Promise<void> {
  try {
    await access(repoPath);
  } catch {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }
}

export type WorkerSpawner = (
  scriptPath: string,
  args: string[],
) => Promise<{ pid: number }> | { pid: number };

async function spawnWorkerProcess(
  scriptPath: string,
  args: string[],
  paths = getStoragePaths(),
): Promise<{ pid: number }> {
  const execArgs =
    scriptPath.endsWith(".ts")
      ? ["--import", "tsx", scriptPath, ...args]
      : [scriptPath, ...args];

  const runId = args[0];
  if (!runId) {
    throw new Error("Worker run id is required");
  }

  await ensureStorageDirs(paths);
  const stderrFd = openSync(runLogPath(paths, runId), "a");

  const child = spawn(process.execPath, execArgs, {
    detached: true,
    stdio: ["ignore", "ignore", stderrFd],
    env: process.env,
  });

  if (!child.pid) {
    throw new Error("Failed to start loop worker process");
  }

  child.unref();
  return { pid: child.pid };
}

let workerSpawner: WorkerSpawner = spawnWorkerProcess;

export function setWorkerSpawnerForTesting(spawner: WorkerSpawner): void {
  workerSpawner = spawner;
}

export function resetWorkerSpawnerForTesting(): void {
  workerSpawner = spawnWorkerProcess;
}

export async function startRun(
  input: StartRunInput,
  paths = getStoragePaths(),
): Promise<LoopRun> {
  const definition = await getLoop(input.loopName, paths);
  if (!definition) {
    throw new Error(`Loop definition "${input.loopName}" not found`);
  }

  const provider = assertSupportedProvider(
    input.provider ?? definition.provider ?? DEFAULT_PROVIDER,
  );

  const repoPath = input.repoPath;
  await assertRepoExists(repoPath);

  const resolved = await resolvePrompt({
    prompt: input.prompt,
    presetPath: input.presetPath,
    definition,
    cwd: repoPath,
  });

  const requestedModel = resolveRunModel(input, definition);
  const model =
    provider === "cursor"
      ? await assertValidModel(requestedModel)
      : requestedModel;

  const run: LoopRun = {
    id: createRunId(),
    loopName: input.loopName,
    provider,
    model,
    repoPath,
    prompt: resolved.text,
    presetPath: resolved.presetPath,
    status: "starting",
    continuous: !input.once,
    limits: {
      budgetUsd: input.budgetUsd,
      maxTasks: input.maxTasks,
    },
    tasksCompleted: 0,
    usage: createEmptyUsage(),
    estimatedCostUsd: 0,
    startedAt: nowIso(),
    updatedAt: nowIso(),
  };

  await saveRun(run, paths);

  if (process.env.LOOPS_TEST_MODE !== "1") {
    const workerScript = getWorkerScriptPath(import.meta.url);
    const spawnResult = await workerSpawner(workerScript, [run.id]);
    run.pid = spawnResult.pid;
  }

  run.status = "running";
  await saveRun(run, paths);

  return run;
}

async function stopReconciledZombieRun(
  run: LoopRun,
  paths: StoragePaths,
): Promise<LoopRun> {
  run.status = "stopped";
  run.error = undefined;
  await saveRun(run, paths);
  return run;
}

async function terminateWorkerProcess(pid: number): Promise<void> {
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (!isErrnoCode(error, "ESRCH")) {
      throw error;
    }
  }
}

export async function stopRun(
  target: string,
  paths = getStoragePaths(),
): Promise<LoopRun> {
  const runs = await listRuns(paths);

  let run: LoopRun;
  try {
    run = resolveRunTarget(target, runs, { activeOnly: true });
  } catch (error) {
    if (!(error instanceof RunNotFoundError)) {
      throw error;
    }

    const latest = resolveRunTarget(target, runs, { activeOnly: false });
    if (isWorkerExitedError(latest)) {
      return stopReconciledZombieRun(latest, paths);
    }

    throw error;
  }

  if (!isActiveRun(run)) {
    throw new Error(`Run "${run.id}" is not active (status: ${run.status})`);
  }

  if (run.pid) {
    await terminateWorkerProcess(run.pid);
  }

  run.status = "stopped";
  run.pid = undefined;
  await saveRun(run, paths);
  return run;
}
