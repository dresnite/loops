import { defineCommand } from "citty";
import {
  formatRunPromptDisplay,
  getRunForPromptTarget,
} from "../core/run-prompt.js";

export default defineCommand({
  meta: {
    name: "show",
    description: "Show the prompt for a loop run",
  },
  args: {
    target: {
      type: "positional",
      description: "Loop name or run id",
      required: true,
    },
  },
  async run({ args }) {
    const run = await getRunForPromptTarget(args.target);
    console.log(formatRunPromptDisplay(run));
  },
});
