import { defineCommand } from "citty";
import {
  getCursorApiKeyFromEnv,
  listConfiguredProviders,
  maskApiKey,
} from "../core/credentials.js";

export default defineCommand({
  meta: {
    name: "list",
    description: "List configured provider API keys",
  },
  async run() {
    const configured = await listConfiguredProviders();
    const envKey = getCursorApiKeyFromEnv();

    if (configured.length === 0 && !envKey) {
      console.log("No API keys configured.");
      console.log("Run: loops key set cursor <your-key>");
      return;
    }

    for (const entry of configured) {
      console.log(`${entry.provider}: ${entry.masked} (stored)`);
    }

    if (envKey) {
      console.log(`cursor: ${maskApiKey(envKey)} (CURSOR_API_KEY env override)`);
    }
  },
});
