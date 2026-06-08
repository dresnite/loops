import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "model",
    description: "View or update the model for a loop run",
  },
  subCommands: {
    show: () => import("./model-show.js").then((module) => module.default),
    set: () => import("./model-set.js").then((module) => module.default),
  },
});
