import { defineCommand, runMain } from "citty";
import { PLANNED_PROVIDERS, SUPPORTED_PROVIDERS } from "./constants.js";

const providerNote = `Providers: ${SUPPORTED_PROVIDERS.join(", ")} (planned: ${PLANNED_PROVIDERS.join(", ")})`;

const main = defineCommand({
  meta: {
    name: "loops",
    version: "0.3.1",
    description: `Reusable AI agent workflows for your codebase. ${providerNote}`,
  },
  subCommands: {
    key: () => import("./commands/key.js").then((module) => module.default),
    add: () => import("./commands/add.js").then((module) => module.default),
    run: () => import("./commands/run.js").then((module) => module.default),
    ls: () => import("./commands/ls.js").then((module) => module.default),
    logs: () => import("./commands/logs.js").then((module) => module.default),
    prompt: () => import("./commands/prompt.js").then((module) => module.default),
    model: () => import("./commands/model.js").then((module) => module.default),
    stop: () => import("./commands/stop.js").then((module) => module.default),
    rm: () => import("./commands/rm.js").then((module) => module.default),
  },
});

runMain(main);
