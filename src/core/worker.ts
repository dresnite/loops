import { join } from "pathe";
import { getProvider } from "../providers/index.js";
import type { LoopRun, TokenUsage } from "../types.js";
import { getErrorMessage } from "./errors.js";
import {
  estimateCostUsd,
  mergeUsage,
  shouldStopForLimits,
} from "./limits.js";
import { appendRunLog } from "./logs.js";
import { isWorkerCliInvocation } from "./paths.js";
import { getRun, saveRun } from "./runner.js";
import { StreamEventLogger } from "./stream-log.js";
import { getStoragePaths, readJson } from "./storage.js";

const STOP_POLL_MS = 500;
const USAGE_SAVE_DEBOUNCE_MS = 300;

function createDebouncedRunSaver(runId: string): {
  schedule: (run: LoopRun) => void;
  flush: () => Promise<void>;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latestRun: LoopRun | undefined;
  let pendingSave: Promise<void> | undefined;

  const flush = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }

    if (!latestRun) {
      await pendingSave;
      return;
    }

    const snapshot = latestRun;
    latestRun = undefined;
    pendingSave = saveRun(snapshot).catch(async (error) => {
      await log(runId, `[error] failed to persist run state: ${getErrorMessage(error)}`);
    });
    await pendingSave;
    pendingSave = undefined;
  };

  return {
    schedule(run: LoopRun) {
      latestRun = run;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void flush();
      }, USAGE_SAVE_DEBOUNCE_MS);
    },
    flush,
  };
}

async function log(runId: string, message: string): Promise<void> {
  await appendRunLog(runId, message);
}

async function isStopRequested(run: LoopRun): Promise<boolean> {
  const latest = await getRun(run.id);
  return latest?.status === "stopped";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function consumeRun(
  run: LoopRun,
  prompt: string,
  taskNumber: number,
): Promise<{ status: "finished" | "error" | "cancelled"; usage: TokenUsage }> {
  const provider = getProvider(run.provider);
  const session = await provider.createSession({ repoPath: run.repoPath });
  run.agentId = session.agentId;
  await saveRun(run);

  const usageSaver = createDebouncedRunSaver(run.id);

  try {
    await log(run.id, `[task ${taskNumber}] sending prompt`);

    const agentRun = await session.send(prompt, {
      onUsage: (usage) => {
        run.usage = mergeUsage(run.usage, usage);
        run.estimatedCostUsd = estimateCostUsd(run.usage);
        usageSaver.schedule(run);
      },
    });
    run.currentRunId = agentRun.id;
    await saveRun(run);

    const streamLogger = new StreamEventLogger((message) => log(run.id, message));

    for await (const event of agentRun.stream()) {
      if (await isStopRequested(run)) {
        await agentRun.cancel();
        await streamLogger.flush();
        await log(run.id, "[stop] requested");
        return { status: "cancelled", usage: run.usage };
      }

      await streamLogger.handle(event);
    }

    await streamLogger.flush();

    const result = await agentRun.wait();
    if (result.status === "error") {
      run.error = result.result ?? "run failed";
      await saveRun(run);
      await log(run.id, `[task ${taskNumber}] error: ${run.error}`);
      return { status: "error", usage: run.usage };
    }

    if (result.status === "cancelled") {
      await log(run.id, `[task ${taskNumber}] cancelled`);
      return { status: "cancelled", usage: run.usage };
    }

    await log(run.id, `[task ${taskNumber}] finished`);
    return { status: "finished", usage: run.usage };
  } finally {
    run.currentRunId = undefined;
    await usageSaver.flush();
    await saveRun(run);
    await session.dispose();
  }
}

export async function executeWorker(runId: string): Promise<number> {
  const paths = getStoragePaths();
  const run = await getRun(runId, paths);

  if (!run) {
    console.error(`Run "${runId}" not found`);
    return 1;
  }

  run.status = "running";
  run.pid = process.pid;
  await saveRun(run, paths);
  await log(
    run.id,
    `[start] loop=${run.loopName} repo=${run.repoPath}`,
  );

  try {
    while (true) {
      if (await isStopRequested(run)) {
        run.status = "stopped";
        await saveRun(run, paths);
        await log(run.id, "[stop] requested");
        return 0;
      }

      const taskNumber = run.tasksCompleted + 1;
      const outcome = await consumeRun(run, run.prompt, taskNumber);
      run.tasksCompleted += 1;
      run.estimatedCostUsd = estimateCostUsd(run.usage);
      await saveRun(run, paths);

      if (outcome.status === "error") {
        run.status = "error";
        await saveRun(run, paths);
        return 2;
      }

      if (outcome.status === "cancelled" || (await isStopRequested(run))) {
        run.status = "stopped";
        await saveRun(run, paths);
        return 0;
      }

      if (!run.continuous) {
        run.status = "finished";
        await saveRun(run, paths);
        return 0;
      }

      if (shouldStopForLimits(run.tasksCompleted, run.estimatedCostUsd, run.limits)) {
        const limitMessage =
          run.limits.maxTasks !== undefined &&
          run.tasksCompleted >= run.limits.maxTasks
            ? "[limit] tasks reached"
            : "[limit] budget reached";
        run.status = "finished";
        await saveRun(run, paths);
        await log(run.id, limitMessage);
        return 0;
      }

      await sleep(STOP_POLL_MS);
    }
  } catch (error) {
    run.status = "error";
    run.error = getErrorMessage(error);
    await saveRun(run, paths);
    await log(run.id, `[error] ${run.error}`);

    if (run.error.startsWith("startup failed")) {
      return 1;
    }

    return 2;
  }
}

async function main(): Promise<void> {
  const runId = process.argv[2];
  if (!runId) {
    console.error("Usage: worker <run-id>");
    process.exit(1);
  }

  const exitCode = await executeWorker(runId);
  process.exit(exitCode);
}

const isMainModule = isWorkerCliInvocation(process.argv, import.meta.url);

async function markRunFailed(runId: string, message: string): Promise<void> {
  const paths = getStoragePaths();
  const run = await readJson<LoopRun>(join(paths.runs, `${runId}.json`));
  if (!run || (run.status !== "running" && run.status !== "starting")) {
    return;
  }

  run.status = "error";
  run.error = message;
  run.pid = undefined;
  await saveRun(run, paths);
}

if (isMainModule) {
  main().catch(async (error) => {
    const runId = process.argv[2];
    const message = getErrorMessage(error);
    console.error(message);

    if (runId) {
      try {
        await markRunFailed(runId, message);
      } catch {
        // Best effort only.
      }
    }

    process.exit(1);
  });
}
