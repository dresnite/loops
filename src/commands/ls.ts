import { defineCommand } from "citty";
import { listRuns } from "../core/runner.js";
import { formatRunLine } from "./_shared.js";

export default defineCommand({
  meta: {
    name: "ls",
    description: "List running loops",
  },
  async run() {
    const runs = await listRuns();
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
