import { defineCommand, runMain } from "citty";
import { PLANNED_PROVIDERS, SUPPORTED_PROVIDERS } from "./constants.js";

const providerNote = `Providers: ${SUPPORTED_PROVIDERS.join(", ")} (planned: ${PLANNED_PROVIDERS.join(", ")})`;

const main = defineCommand({
  meta: {
    name: "loops",
    version: "0.1.0",
    description: `Reusable AI agent workflows for your codebase. ${providerNote}`,
  },
  subCommands: {
    key: () => import("./commands/key.js").then((module) => module.default),
    add: () => import("./commands/add.js").then((module) => module.default),
    run: () => import("./commands/run.js").then((module) => module.default),
    ls: () => import("./commands/ls.js").then((module) => module.default),
    logs: () => import("./commands/logs.js").then((module) => module.default),
    stop: () => import("./commands/stop.js").then((module) => module.default),
    rm: () => import("./commands/rm.js").then((module) => module.default),
  },
});

runMain(main);
