import type { LoopRun } from "../types.js";
import { isErrnoCode } from "./errors.js";

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

export function shouldReconcileRun(run: LoopRun): boolean {
  return (
    (run.status === "running" || run.status === "starting") &&
    run.pid !== undefined &&
    !isProcessAlive(run.pid)
  );
}

export function reconcileRunState(run: LoopRun): LoopRun {
  if (!shouldReconcileRun(run)) {
    return run;
  }

  return {
    ...run,
    status: "error",
    error: "worker process exited unexpectedly",
    pid: undefined,
  };
}
