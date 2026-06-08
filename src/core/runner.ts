import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { randomBytes } from "node:crypto";
import { DEFAULT_PROVIDER } from "../constants.js";
import { assertSupportedProvider } from "../providers/index.js";
import type { LoopRun, StartRunInput } from "../types.js";
import { createEmptyUsage } from "./limits.js";
import { resolvePrompt } from "./prompt.js";
import { getLoop } from "./registry.js";
import {
  ensureStorageDirs,
  getStoragePaths,
  listJsonFiles,
  readJson,
  writeJsonAtomic,
  type StoragePaths,
} from "./storage.js";

function runPath(paths: StoragePaths, runId: string): string {
  return join(paths.runs, `${runId}.json`);
}

function nowIso(): string {
  return new Date().toISOString();
}

function createRunId(): string {
  return randomBytes(4).toString("hex");
}

export async function getRun(
  runId: string,
  paths = getStoragePaths(),
): Promise<LoopRun | null> {
  return readJson<LoopRun>(runPath(paths, runId));
}

export async function saveRun(
  run: LoopRun,
  paths = getStoragePaths(),
): Promise<void> {
  await ensureStorageDirs(paths);
  run.updatedAt = nowIso();
  await writeJsonAtomic(runPath(paths, run.id), run);
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

  return runs
    .filter((run): run is LoopRun => run !== null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function listActiveRunsForLoop(
  loopName: string,
  paths = getStoragePaths(),
): Promise<LoopRun[]> {
  const runs = await listRuns(paths);
  return runs.filter(
    (run) =>
      run.loopName === loopName &&
      (run.status === "running" || run.status === "starting"),
  );
}

export function findRunByPrefix(
  runs: LoopRun[],
  prefix: string,
): LoopRun | undefined {
  const matches = runs.filter((run) => run.id.startsWith(prefix));
  if (matches.length === 0) {
    return undefined;
  }

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous run id "${prefix}". Matches: ${matches.map((run) => run.id).join(", ")}`,
    );
  }

  return matches[0];
}

async function assertRepoExists(repoPath: string): Promise<void> {
  try {
    await access(repoPath);
  } catch {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }
}

function getWorkerScriptPath(): string {
  const thisFile = fileURLToPath(import.meta.url);
  if (thisFile.includes("/dist/")) {
    return fileURLToPath(new URL("../../worker.mjs", import.meta.url));
  }
  return fileURLToPath(new URL("./worker.ts", import.meta.url));
}

export type WorkerSpawner = (
  scriptPath: string,
  args: string[],
) => { pid: number };

function spawnWorkerProcess(scriptPath: string, args: string[]): { pid: number } {
  const execArgs =
    scriptPath.endsWith(".ts")
      ? ["--import", "tsx", scriptPath, ...args]
      : [scriptPath, ...args];

  const child = spawn(process.execPath, execArgs, {
    detached: true,
    stdio: "ignore",
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

  const run: LoopRun = {
    id: createRunId(),
    loopName: input.loopName,
    provider,
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
    const workerScript = getWorkerScriptPath();
    const { pid } = workerSpawner(workerScript, [run.id]);
    run.pid = pid;
  }

  run.status = "running";
  await saveRun(run, paths);

  return run;
}

export async function stopRun(
  runIdPrefix: string,
  paths = getStoragePaths(),
): Promise<LoopRun> {
  const runs = await listRuns(paths);
  const run = findRunByPrefix(runs, runIdPrefix);

  if (!run) {
    throw new Error(`No run found matching id prefix "${runIdPrefix}"`);
  }

  if (run.status !== "running" && run.status !== "starting") {
    throw new Error(`Run "${run.id}" is not active (status: ${run.status})`);
  }

  if (run.pid) {
    try {
      process.kill(run.pid, "SIGTERM");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        throw error;
      }
    }
  }

  run.status = "stopped";
  run.pid = undefined;
  await saveRun(run, paths);
  return run;
}
