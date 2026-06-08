import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { isCancel } from "@clack/prompts";
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PLANNED_PROVIDERS } from "../constants.js";
import { addLoop } from "../core/registry.js";

export default defineCommand({
  meta: {
    name: "add",
    description: "Create a new loop definition",
  },
  args: {
    name: {
      type: "positional",
      description: "Loop name",
      required: true,
    },
    description: {
      type: "string",
      description: "Loop description",
      alias: "d",
    },
    prompt: {
      type: "string",
      description: "Default inline prompt",
    },
    preset: {
      type: "string",
      description: "Default preset file path",
    },
    interactive: {
      type: "boolean",
      description: "Prompt for optional fields",
      default: false,
    },
    model: {
      type: "string",
      description: `Default agent model (default: ${DEFAULT_MODEL})`,
    },
  },
  async run({ args }) {
    let description = args.description;
    let defaultPrompt = args.prompt;
    let defaultPreset = args.preset;
    let defaultModel = args.model;

    if (args.interactive) {
      p.intro(`Create loop "${args.name}"`);

      const desc = await p.text({
        message: "Description (optional)",
        placeholder: "What does this loop do?",
      });
      if (isCancel(desc)) {
        p.cancel("Cancelled");
        process.exit(0);
      }
      if (desc) {
        description = desc;
      }

      const preset = await p.text({
        message: "Default preset path (optional)",
        placeholder: "./prompts/refactor.md",
      });
      if (isCancel(preset)) {
        p.cancel("Cancelled");
        process.exit(0);
      }
      if (preset) {
        defaultPreset = preset;
      }

      if (!defaultPreset) {
        const prompt = await p.text({
          message: "Default prompt (optional)",
          placeholder: "Improve project structure",
        });
        if (isCancel(prompt)) {
          p.cancel("Cancelled");
          process.exit(0);
        }
        if (prompt) {
          defaultPrompt = prompt;
        }
      }

      const model = await p.text({
        message: "Default model (optional)",
        placeholder: DEFAULT_MODEL,
      });
      if (isCancel(model)) {
        p.cancel("Cancelled");
        process.exit(0);
      }
      if (model) {
        defaultModel = model;
      }

      p.outro(
        `Provider: ${DEFAULT_PROVIDER} (${PLANNED_PROVIDERS.join(", ")} coming soon)`,
      );
    }

    const definition = await addLoop({
      name: args.name,
      description,
      defaultPrompt,
      defaultPreset,
      defaultModel,
    });

    console.log(`Created loop "${definition.name}"`);
  },
});
