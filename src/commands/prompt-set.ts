import { defineCommand } from "citty";
import { setRunPrompt } from "../core/run-prompt.js";

export default defineCommand({
  meta: {
    name: "set",
    description: "Update the prompt for a loop run",
  },
  args: {
    target: {
      type: "positional",
      description: "Loop name or run id",
      required: true,
    },
    prompt: {
      type: "string",
      description: "Inline prompt text",
    },
    preset: {
      type: "string",
      description: "Preset instruction file (relative to run repo)",
    },
  },
  async run({ args }) {
    const run = await setRunPrompt(args.target, {
      prompt: args.prompt,
      presetPath: args.preset,
    });

    console.log(`Updated prompt for run ${run.id} (${run.loopName})`);
  },
});
