import { defineCommand } from "citty";
import { followRunLog, readRunLog } from "../core/logs.js";
import { listRuns } from "../core/runner.js";
import { resolveRunTarget } from "../core/resolve.js";

export default defineCommand({
  meta: {
    name: "logs",
    description: "View logs for a loop run",
  },
  args: {
    target: {
      type: "positional",
      description: "Loop name or run id",
      required: true,
    },
    follow: {
      type: "boolean",
      description: "Follow log output",
      alias: "f",
      default: false,
    },
    lines: {
      type: "string",
      description: "Number of lines to show",
      alias: "n",
      default: "50",
    },
  },
  async run({ args }) {
    const runs = await listRuns();
    const run = resolveRunTarget(args.target, runs);

    console.log(
      `Run ${run.id} (${run.loopName}) — status: ${run.status}`,
    );

    if (run.error) {
      console.log(`Error: ${run.error}`);
    }

    console.log("---");

    const lineCount = Number.parseInt(args.lines, 10);
    const tail = Number.isFinite(lineCount) && lineCount > 0 ? lineCount : 50;

    if (!args.follow) {
      const lines = await readRunLog(run.id, { tail });
      if (lines.length === 0) {
        console.log("No log output yet.");
        return;
      }

      for (const line of lines) {
        console.log(line);
      }
      return;
    }

    const initialLines = await readRunLog(run.id, { tail });
    for (const line of initialLines) {
      console.log(line);
    }

    const stop = await followRunLog(run.id, (line) => {
      console.log(line);
    });

    await new Promise<void>((resolve) => {
      const onSignal = () => {
        stop();
        resolve();
      };

      process.once("SIGINT", onSignal);
      process.once("SIGTERM", onSignal);
    });
  },
});
