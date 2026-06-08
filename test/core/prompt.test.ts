import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, describe, expect, it } from "vitest";
import { resolvePrompt } from "../../src/core/prompt.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("resolvePrompt", () => {
  it("prefers inline prompt over preset and defaults", async () => {
    const resolved = await resolvePrompt({
      prompt: "inline",
      presetPath: "./preset.md",
      definition: { defaultPrompt: "default" } as never,
    });

    expect(resolved.text).toBe("inline");
  });

  it("reads preset files when no inline prompt is provided", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);

    const presetPath = join(homeDir, "preset.md");
    await writeFile(presetPath, "  preset content  \n", "utf8");

    const resolved = await resolvePrompt({
      presetPath,
      cwd: homeDir,
    });

    expect(resolved.text).toBe("preset content");
    expect(resolved.presetPath).toBe(presetPath);
  });

  it("falls back to definition default prompt", async () => {
    const resolved = await resolvePrompt({
      definition: {
        defaultPrompt: "default prompt",
      } as never,
    });

    expect(resolved.text).toBe("default prompt");
  });

  it("throws when no prompt source is available", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    await mkdir(homeDir, { recursive: true });

    await expect(resolvePrompt({ cwd: homeDir })).rejects.toThrow(
      "No prompt provided",
    );
  });
});
