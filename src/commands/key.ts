import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "key",
    description: "Manage provider API keys",
  },
  subCommands: {
    set: () => import("./key-set.js").then((module) => module.default),
    list: () => import("./key-list.js").then((module) => module.default),
  },
});
