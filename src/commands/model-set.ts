import { defineCommand } from "citty";
import { requireCursorApiKey } from "../core/credentials.js";
import { getRunForModelTarget, setRunModel } from "../core/run-model.js";

export default defineCommand({
  meta: {
    name: "set",
    description: "Update the model for a loop run",
  },
  args: {
    target: {
      type: "positional",
      description: "Loop name or run id",
      required: true,
    },
    model: {
      type: "string",
      description: "Agent model id",
      required: true,
    },
  },
  async run({ args }) {
    const run = await getRunForModelTarget(args.target);
    if (run.provider === "cursor") {
      await requireCursorApiKey();
    }

    const updated = await setRunModel(args.target, args.model);
    console.log(
      `Updated model for run ${updated.id} (${updated.loopName}) to ${updated.model}`,
    );
  },
});
