import type { LoopRun } from "../types.js";
import { appendRunLog } from "./logs.js";
import { assertValidModel } from "./models.js";
import { resolveRunTarget } from "./resolve.js";
import { listRuns, readRunRaw, saveRun } from "./runner.js";
import { getStoragePaths, type StoragePaths } from "./storage.js";

export async function getRunForModelTarget(
  target: string,
  paths = getStoragePaths(),
): Promise<LoopRun> {
  const runs = await listRuns(paths);
  return resolveRunTarget(target, runs);
}

export function formatRunModelDisplay(run: LoopRun): string {
  return [
    `Run ${run.id} (${run.loopName}) — status: ${run.status}`,
    `Model: ${run.model}`,
    `Repo: ${run.repoPath}`,
    `Provider: ${run.provider}`,
  ].join("\n");
}

export async function setRunModel(
  target: string,
  modelId: string,
  paths = getStoragePaths(),
): Promise<LoopRun> {
  const trimmed = modelId.trim();
  if (trimmed.length === 0) {
    throw new Error("Model cannot be empty.");
  }

  const run = await getRunForModelTarget(target, paths);
  run.model =
    run.provider === "cursor"
      ? await assertValidModel(trimmed)
      : trimmed;

  await saveRun(run, paths);
  await appendRunLog(run.id, `[model] updated to ${run.model}`, paths);
  return run;
}

export async function syncRunModelFromDisk(
  run: LoopRun,
  paths = getStoragePaths(),
): Promise<void> {
  const latest = await readRunRaw(run.id, paths);
  if (!latest) {
    return;
  }

  run.model = latest.model;
}
