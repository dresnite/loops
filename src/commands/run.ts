import { defineCommand } from "citty";
import { DEFAULT_PROVIDER } from "../constants.js";
import { requireCursorApiKey } from "../core/credentials.js";
import { startRun } from "../core/runner.js";
import {
  parseBudget,
  parseTasks,
  resolveRepoPath,
} from "./_shared.js";

export default defineCommand({
  meta: {
    name: "run",
    description: "Start a loop on a repository",
  },
  args: {
    name: {
      type: "positional",
      description: "Loop name",
      required: true,
    },
    repo: {
      type: "string",
      description: "Repository path",
    },
    preset: {
      type: "string",
      description: "Preset instruction file",
    },
    prompt: {
      type: "string",
      description: "Inline prompt",
    },
    budget: {
      type: "string",
      description: "Maximum spend in USD",
    },
    tasks: {
      type: "string",
      description: "Maximum number of tasks",
    },
    once: {
      type: "boolean",
      description: "Run once and exit",
      default: false,
    },
    provider: {
      type: "string",
      description: `Agent provider (default: ${DEFAULT_PROVIDER})`,
      default: DEFAULT_PROVIDER,
    },
  },
  async run({ args }) {
    if (args.provider === "cursor" || !args.provider) {
      await requireCursorApiKey();
    }

    const run = await startRun({
      loopName: args.name,
      repoPath: resolveRepoPath(args.repo),
      presetPath: args.preset,
      prompt: args.prompt,
      budgetUsd: parseBudget(args.budget),
      maxTasks: parseTasks(args.tasks),
      once: args.once,
      provider: args.provider as typeof DEFAULT_PROVIDER,
    });

    console.log(`Started loop "${run.loopName}" (run-id: ${run.id})`);
  },
});
