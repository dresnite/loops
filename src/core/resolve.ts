import type { LoopRun } from "../types.js";
import { isActiveRun } from "./run-state.js";

export class RunNotFoundError extends Error {
  readonly target: string;

  constructor(target: string) {
    super(`No run found for "${target}"`);
    this.name = "RunNotFoundError";
    this.target = target;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ResolveRunTargetOptions {
  activeOnly?: boolean;
}

export function resolveRunTarget(
  target: string,
  runs: LoopRun[],
  options: ResolveRunTargetOptions = {},
): LoopRun {
  const pool = options.activeOnly ? runs.filter(isActiveRun) : runs;
  const byIdPrefix = pool.filter((run) => run.id.startsWith(target));

  if (byIdPrefix.length === 1) {
    return byIdPrefix[0]!;
  }

  if (byIdPrefix.length > 1) {
    throw new Error(
      `Ambiguous run id "${target}". Matches: ${byIdPrefix.map((run) => run.id).join(", ")}`,
    );
  }

  const byName = pool.filter((run) => run.loopName === target);

  if (byName.length === 1) {
    return byName[0]!;
  }

  if (byName.length > 1) {
    if (options.activeOnly) {
      throw new Error(
        `Ambiguous loop "${target}". Active runs: ${byName.map((run) => run.id).join(", ")}. Use loops stop <run-id>.`,
      );
    }

    return byName.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
  }

  throw new RunNotFoundError(target);
}
