import { defineCommand } from "citty";
import {
  formatRunModelDisplay,
  getRunForModelTarget,
} from "../core/run-model.js";

export default defineCommand({
  meta: {
    name: "show",
    description: "Show the model for a loop run",
  },
  args: {
    target: {
      type: "positional",
      description: "Loop name or run id",
      required: true,
    },
  },
  async run({ args }) {
    const run = await getRunForModelTarget(args.target);
    console.log(formatRunModelDisplay(run));
  },
});
