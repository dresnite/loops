import type { LoopRun, RunStatus } from "../types.js";

const ACTIVE_RUN_STATUSES: ReadonlySet<RunStatus> = new Set([
  "starting",
  "running",
]);

export function isActiveRun(run: LoopRun): boolean {
  return ACTIVE_RUN_STATUSES.has(run.status);
}

export function isRunStopped(run: LoopRun): boolean {
  return run.status === "stopped";
}

export function isLsDefaultVisible(run: LoopRun): boolean {
  return isActiveRun(run) || run.status === "error";
}
