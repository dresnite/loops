import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readRunLog } from "../../src/core/logs.js";
import {
  formatRunPromptDisplay,
  setRunPrompt,
  syncRunPromptFromDisk,
} from "../../src/core/run-prompt.js";
import { addLoop } from "../../src/core/registry.js";
import { getRun, saveRun, startRun } from "../../src/core/runner.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { DEFAULT_MODEL } from "../../src/constants.js";
import { setModelListForTesting } from "../../src/core/models.js";
import { makeTestRun } from "../helpers/make-run.js";
import { createTempHome } from "../helpers/temp-home.js";
import { setupTestRuntime } from "../helpers/test-runtime.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  setModelListForTesting(null);
  vi.unstubAllEnvs();
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("run-prompt", () => {
  it("formats run prompt display", () => {
    const output = formatRunPromptDisplay(
      makeTestRun({
        prompt: "Improve structure",
        presetPath: "./prompts/refactor.md",
      }),
    );

    expect(output).toContain("loops-improvement");
    expect(output).toContain(`Model: ${DEFAULT_MODEL}`);
    expect(output).toContain("Preset: ./prompts/refactor.md");
    expect(output).toContain("---");
    expect(output).toContain("Improve structure");
  });

  it("sets inline prompt and clears preset path", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    const paths = getStoragePaths(homeDir);

    const run = makeTestRun({
      prompt: "old prompt",
      presetPath: "./old.md",
    });
    await saveRun(run, paths);

    const updated = await setRunPrompt(run.id, { prompt: "new prompt" }, paths);

    expect(updated.prompt).toBe("new prompt");
    expect(updated.presetPath).toBeUndefined();

    const persisted = await getRun(run.id, paths);
    expect(persisted?.prompt).toBe("new prompt");

    const lines = await readRunLog(run.id, { tail: 5 }, paths);
    expect(lines.some((line) => line.includes("[prompt] updated"))).toBe(true);
  });

  it("sets prompt from preset file relative to repo", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    const paths = getStoragePaths(homeDir);

    const repoPath = join(homeDir, "repo");
    await mkdir(repoPath, { recursive: true });
    await writeFile(join(repoPath, "preset.md"), "  preset body  \n", "utf8");

    const run = makeTestRun({ repoPath, prompt: "old" });
    await saveRun(run, paths);

    const updated = await setRunPrompt(
      run.id,
      { presetPath: "./preset.md" },
      paths,
    );

    expect(updated.prompt).toBe("preset body");
    expect(updated.presetPath).toBe(join(repoPath, "preset.md"));
  });

  it("rejects invalid set input", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    const paths = getStoragePaths(homeDir);

    const run = makeTestRun();
    await saveRun(run, paths);

    await expect(setRunPrompt(run.id, {}, paths)).rejects.toThrow(
      "Provide exactly one of --prompt or --preset.",
    );
    await expect(
      setRunPrompt(run.id, { prompt: "a", presetPath: "./x.md" }, paths),
    ).rejects.toThrow("Provide exactly one of --prompt or --preset.");
    await expect(setRunPrompt(run.id, { prompt: "   " }, paths)).rejects.toThrow(
      "Prompt cannot be empty.",
    );
  });

  it("syncs prompt fields from disk without reloading other run state", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    const paths = getStoragePaths(homeDir);

    const run = makeTestRun({ prompt: "in memory", tasksCompleted: 2 });
    await saveRun(run, paths);

    run.prompt = "in memory";
    run.tasksCompleted = 2;

    const onDisk = await getRun(run.id, paths);
    onDisk!.prompt = "from disk";
    onDisk!.presetPath = "./from-disk.md";
    onDisk!.tasksCompleted = 0;
    await saveRun(onDisk!, paths);

    await syncRunPromptFromDisk(run, paths);

    expect(run.prompt).toBe("from disk");
    expect(run.presetPath).toBe("./from-disk.md");
    expect(run.tasksCompleted).toBe(2);
  });
});
