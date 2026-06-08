import { runCommand } from "citty";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import addCommand from "../../src/commands/add.js";
import runCommandDef from "../../src/commands/run.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("loops run auth", () => {
  it("complains when cursor api key is missing", async () => {
    vi.unstubAllEnvs();
    delete process.env.LOOPS_TEST_MODE;

    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);

    const repoPath = join(homeDir, "repo");
    await mkdir(repoPath, { recursive: true });
    await writeFile(join(repoPath, "README.md"), "# demo", "utf8");

    await runCommand(addCommand, {
      rawArgs: ["structure-agent", "--prompt", "Improve structure"],
    });

    await expect(
      runCommand(runCommandDef, {
        rawArgs: ["structure-agent", "--repo", repoPath],
      }),
    ).rejects.toThrow("Cursor API key not configured");
  });
});
