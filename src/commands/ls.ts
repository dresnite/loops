import { defineCommand } from "citty";
import { listRuns } from "../core/runner.js";
import { formatRunLine } from "./_shared.js";

const ALL_RUNS_LIMIT = 20;

export default defineCommand({
  meta: {
    name: "ls",
    description: "List running loops",
  },
  args: {
    all: {
      type: "boolean",
      description: "Show recent runs including finished and failed",
      alias: "a",
      default: false,
    },
  },
  async run({ args }) {
    const runs = await listRuns();

    if (args.all) {
      const recent = runs
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, ALL_RUNS_LIMIT);

      if (recent.length === 0) {
        console.log("No runs found.");
        return;
      }

      for (const run of recent) {
        console.log(formatRunLine(run));
      }
      return;
    }

    const active = runs.filter(
      (run) => run.status === "running" || run.status === "starting",
    );

    if (active.length === 0) {
      console.log("No running loops.");
      return;
    }

    for (const run of active) {
      console.log(formatRunLine(run));
    }
  },
});
