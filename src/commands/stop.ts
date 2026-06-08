import { defineCommand } from "citty";
import { stopRun } from "../core/runner.js";

export default defineCommand({
  meta: {
    name: "stop",
    description: "Stop a running loop",
  },
  args: {
    runId: {
      type: "positional",
      description: "Run id or prefix",
      required: true,
    },
  },
  async run({ args }) {
    const run = await stopRun(args.runId);
    console.log(`Stopped loop "${run.loopName}" (run-id: ${run.id})`);
  },
});
