import type { LoopRun } from "../types.js";
import { isErrnoCode } from "./errors.js";
import { isActiveRun } from "./run-state.js";

export const WORKER_EXITED_UNEXPECTEDLY = "worker process exited unexpectedly";

export function isWorkerExitedError(run: LoopRun): boolean {
  return run.status === "error" && run.error === WORKER_EXITED_UNEXPECTEDLY;
}

type ProcessAliveChecker = (pid: number) => boolean;

let processAliveChecker: ProcessAliveChecker | null = null;

function defaultProcessAliveChecker(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (isErrnoCode(error, "ESRCH")) {
      return false;
    }
    throw error;
  }
}

export function isProcessAlive(pid: number): boolean {
  const checker = processAliveChecker ?? defaultProcessAliveChecker;
  return checker(pid);
}

export function setProcessAliveCheckerForTesting(
  checker: ProcessAliveChecker | null,
): void {
  processAliveChecker = checker;
}

export function resetProcessAliveCheckerForTesting(): void {
  processAliveChecker = null;
}

export function shouldReconcileRun(run: LoopRun): boolean {
  return (
    isActiveRun(run) && run.pid !== undefined && !isProcessAlive(run.pid)
  );
}

export function reconcileRunState(run: LoopRun): LoopRun {
  if (!shouldReconcileRun(run)) {
    return run;
  }

  return {
    ...run,
    status: "error",
    error: WORKER_EXITED_UNEXPECTEDLY,
    pid: undefined,
  };
}
