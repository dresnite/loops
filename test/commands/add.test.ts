import { runCommand } from "citty";
import { afterEach, describe, expect, it, vi } from "vitest";
import addCommand from "../../src/commands/add.js";
import { getLoop } from "../../src/core/registry.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("loops add", () => {
  it("creates a loop definition", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);

    await runCommand(addCommand, {
      rawArgs: ["refactor", "--description", "Refactor code", "--prompt", "Improve structure"],
    });

    const definition = await getLoop("refactor", getStoragePaths(homeDir));
    expect(definition).toMatchObject({
      name: "refactor",
      description: "Refactor code",
      defaultPrompt: "Improve structure",
    });
  });
});
