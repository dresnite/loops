import type { LoopRun } from "../types.js";

export function isActiveRun(run: LoopRun): boolean {
  return run.status === "running" || run.status === "starting";
}

export interface ResolveRunTargetOptions {
  activeOnly?: boolean;
}

export function resolveRunTarget(
  target: string,
  runs: LoopRun[],
  options: ResolveRunTargetOptions = {},
): LoopRun {
  const idPool = options.activeOnly ? runs.filter(isActiveRun) : runs;
  const byIdPrefix = idPool.filter((run) => run.id.startsWith(target));

  if (byIdPrefix.length === 1) {
    return byIdPrefix[0]!;
  }

  if (byIdPrefix.length > 1) {
    throw new Error(
      `Ambiguous run id "${target}". Matches: ${byIdPrefix.map((run) => run.id).join(", ")}`,
    );
  }

  const namePool = options.activeOnly ? runs.filter(isActiveRun) : runs;
  const byName = namePool.filter((run) => run.loopName === target);

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

  throw new Error(`No run found for "${target}"`);
}
