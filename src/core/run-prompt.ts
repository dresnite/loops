import type { LoopRun } from "../types.js";
import { syncRunModelFromDisk } from "./run-model.js";
import { appendRunLog } from "./logs.js";
import { resolvePrompt } from "./prompt.js";
import { resolveRunTarget } from "./resolve.js";
import { listRuns, readRunRaw, saveRun } from "./runner.js";
import { getStoragePaths, type StoragePaths } from "./storage.js";

export interface SetRunPromptInput {
  prompt?: string;
  presetPath?: string;
}

export async function getRunForPromptTarget(
  target: string,
  paths = getStoragePaths(),
): Promise<LoopRun> {
  const runs = await listRuns(paths);
  return resolveRunTarget(target, runs);
}

export function formatRunPromptDisplay(run: LoopRun): string {
  const lines = [
    `Run ${run.id} (${run.loopName}) — status: ${run.status}`,
    `Model: ${run.model}`,
    `Repo: ${run.repoPath}`,
  ];

  if (run.presetPath) {
    lines.push(`Preset: ${run.presetPath}`);
  }

  lines.push("---", run.prompt);
  return lines.join("\n");
}

function assertSetRunPromptInput(input: SetRunPromptInput): void {
  const hasPrompt = input.prompt !== undefined;
  const hasPreset = input.presetPath !== undefined;

  if (hasPrompt === hasPreset) {
    throw new Error("Provide exactly one of --prompt or --preset.");
  }

  if (hasPrompt && input.prompt!.trim().length === 0) {
    throw new Error("Prompt cannot be empty.");
  }
}

export async function setRunPrompt(
  target: string,
  input: SetRunPromptInput,
  paths = getStoragePaths(),
): Promise<LoopRun> {
  assertSetRunPromptInput(input);

  const run = await getRunForPromptTarget(target, paths);

  if (input.prompt !== undefined) {
    run.prompt = input.prompt.trim();
    run.presetPath = undefined;
  } else {
    const resolved = await resolvePrompt({
      presetPath: input.presetPath,
      cwd: run.repoPath,
    });
    run.prompt = resolved.text;
    run.presetPath = resolved.presetPath;
  }

  await saveRun(run, paths);
  await appendRunLog(run.id, "[prompt] updated", paths);
  return run;
}

export async function syncRunPromptFromDisk(
  run: LoopRun,
  paths = getStoragePaths(),
): Promise<void> {
  const latest = await readRunRaw(run.id, paths);
  if (!latest) {
    return;
  }

  run.prompt = latest.prompt;
  run.presetPath = latest.presetPath;
}

export async function persistWorkerRun(
  run: LoopRun,
  paths = getStoragePaths(),
): Promise<void> {
  await syncRunPromptFromDisk(run, paths);
  await syncRunModelFromDisk(run, paths);
  await saveRun(run, paths);
}
