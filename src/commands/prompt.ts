import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "prompt",
    description: "View or update the prompt for a loop run",
  },
  subCommands: {
    show: () => import("./prompt-show.js").then((module) => module.default),
    set: () => import("./prompt-set.js").then((module) => module.default),
  },
});
