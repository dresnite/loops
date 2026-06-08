import { fileURLToPath, pathToFileURL } from "node:url";
import { getProvider } from "../providers/index.js";
import type { LoopRun, TokenUsage } from "../types.js";
import {
  estimateCostUsd,
  mergeUsage,
  shouldStopForLimits,
} from "./limits.js";
import { getRun, saveRun } from "./runner.js";
import { getStoragePaths } from "./storage.js";

const STOP_POLL_MS = 500;

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
): Promise<{ status: "finished" | "error" | "cancelled"; usage: TokenUsage }> {
  const provider = getProvider(run.provider);
  const session = await provider.createSession({ repoPath: run.repoPath });
  run.agentId = session.agentId;
  await saveRun(run);

  try {
    const agentRun = await session.send(prompt, {
      onUsage: (usage) => {
        run.usage = mergeUsage(run.usage, usage);
        run.estimatedCostUsd = estimateCostUsd(run.usage);
        void saveRun(run);
      },
    });
    run.currentRunId = agentRun.id;
    await saveRun(run);

    for await (const _event of agentRun.stream()) {
      if (await isStopRequested(run)) {
        await agentRun.cancel();
        return { status: "cancelled", usage: run.usage };
      }
    }

    const result = await agentRun.wait();
    if (result.status === "error") {
      run.error = result.result ?? "run failed";
      await saveRun(run);
      return { status: "error", usage: run.usage };
    }

    if (result.status === "cancelled") {
      return { status: "cancelled", usage: run.usage };
    }

    return { status: "finished", usage: run.usage };
  } finally {
    run.currentRunId = undefined;
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
  await saveRun(run, paths);

  try {
    while (true) {
      if (await isStopRequested(run)) {
        run.status = "stopped";
        await saveRun(run, paths);
        return 0;
      }

      const outcome = await consumeRun(run, run.prompt);
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
        run.status = "finished";
        await saveRun(run, paths);
        return 0;
      }

      await sleep(STOP_POLL_MS);
    }
  } catch (error) {
    run.status = "error";
    run.error = error instanceof Error ? error.message : String(error);
    await saveRun(run, paths);

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

function resolveArgPath(arg: string): string {
  try {
    return fileURLToPath(arg);
  } catch {
    return fileURLToPath(pathToFileURL(arg).href);
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  resolveArgPath(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  void main();
}
