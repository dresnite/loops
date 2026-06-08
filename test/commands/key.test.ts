import { runCommand } from "citty";
import { afterEach, describe, expect, it, vi } from "vitest";
import keySetCommand from "../../src/commands/key-set.js";
import keyListCommand from "../../src/commands/key-list.js";
import { getCursorApiKey } from "../../src/core/credentials.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("loops key", () => {
  it("sets and lists stored keys", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    try {
      await runCommand(keySetCommand, {
        rawArgs: ["cursor", "cursor_test_key_123"],
      });

      expect(await getCursorApiKey(getStoragePaths(homeDir))).toBe(
        "cursor_test_key_123",
      );

      await runCommand(keyListCommand, { rawArgs: [] });
      expect(logs.some((line) => line.includes("cursor:"))).toBe(true);
      expect(logs.some((line) => line.includes("stored"))).toBe(true);
    } finally {
      console.log = originalLog;
    }
  });

});
