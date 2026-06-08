import { defineCommand } from "citty";
import { listActiveRunsForLoop } from "../core/runner.js";
import { removeLoop } from "../core/registry.js";

export default defineCommand({
  meta: {
    name: "rm",
    description: "Delete a loop definition",
  },
  args: {
    name: {
      type: "positional",
      description: "Loop name",
      required: true,
    },
  },
  async run({ args }) {
    const active = await listActiveRunsForLoop(args.name);
    if (active.length > 0) {
      const ids = active.map((run) => run.id).join(", ");
      throw new Error(
        `Cannot remove "${args.name}" while runs are active: ${ids}`,
      );
    }

    await removeLoop(args.name);
    console.log(`Removed loop "${args.name}"`);
  },
});
