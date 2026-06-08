import { defineCommand } from "citty";
import { stopRun } from "../core/runner.js";

export default defineCommand({
  meta: {
    name: "stop",
    description: "Stop a running loop",
  },
  args: {
    target: {
      type: "positional",
      description: "Run id, prefix, or loop name",
      required: true,
    },
  },
  async run({ args }) {
    const run = await stopRun(args.target);
    console.log(`Stopped loop "${run.loopName}" (run-id: ${run.id})`);
  },
});
