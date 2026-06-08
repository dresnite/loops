import type { LoopRun, RunStatus } from "../types.js";

const ACTIVE_RUN_STATUSES: ReadonlySet<RunStatus> = new Set([
  "starting",
  "running",
]);

export function isActiveRun(run: LoopRun): boolean {
  return ACTIVE_RUN_STATUSES.has(run.status);
}
