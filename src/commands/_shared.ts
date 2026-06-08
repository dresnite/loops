import { resolve } from "pathe";

export function resolveRepoPath(repo?: string): string {
  return resolve(repo ?? process.cwd());
}

export function parseBudget(value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid budget value: ${value}`);
  }

  return parsed;
}

export function parseTasks(value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid tasks value: ${value}`);
  }

  return parsed;
}

export function formatRunLine(run: {
  id: string;
  loopName: string;
  status: string;
  limits: { budgetUsd?: number; maxTasks?: number };
  tasksCompleted: number;
  estimatedCostUsd: number;
  error?: string;
}): string {
  const parts = [
    `${run.loopName} → ${run.status} (run-id: ${run.id.slice(0, 4)})`,
  ];

  if (run.limits.budgetUsd !== undefined) {
    const percent = Math.min(
      100,
      Math.round((run.estimatedCostUsd / run.limits.budgetUsd) * 100),
    );
    parts.push(`budget used: ${percent}%`);
  }

  if (run.limits.maxTasks !== undefined) {
    parts.push(`tasks: ${run.tasksCompleted}/${run.limits.maxTasks}`);
  }

  if (run.status === "error" && run.error) {
    const snippet =
      run.error.length > 80 ? `${run.error.slice(0, 80)}...` : run.error;
    parts.push(`error: ${snippet}`);
  }

  return parts.join(", ");
}
