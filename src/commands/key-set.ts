import { defineCommand } from "citty";
import { assertSupportedProvider } from "../providers/index.js";
import { setProviderKey } from "../core/credentials.js";

export default defineCommand({
  meta: {
    name: "set",
    description: "Save a provider API key",
  },
  args: {
    provider: {
      type: "positional",
      description: "Provider id (cursor)",
      required: true,
    },
    apiKey: {
      type: "positional",
      description: "API key",
      required: true,
    },
  },
  async run({ args }) {
    const provider = assertSupportedProvider(args.provider);
    await setProviderKey(provider, args.apiKey);
    console.log(`Saved ${provider} API key to ~/.loops/credentials.json`);
  },
});
