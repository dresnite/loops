import { afterEach, describe, expect, it, vi } from "vitest";
import { readRunLog } from "../../src/core/logs.js";
import {
  formatRunModelDisplay,
  setRunModel,
  syncRunModelFromDisk,
} from "../../src/core/run-model.js";
import { persistWorkerRun } from "../../src/core/run-prompt.js";
import { getRun, readRunRaw, saveRun } from "../../src/core/runner.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { COMPOSER_25_FAST_ALIAS } from "../../src/core/models.js";
import { DEFAULT_MODEL } from "../../src/constants.js";
import { setModelListForTesting } from "../../src/core/models.js";
import { COMPOSER_25_WITH_FAST_PARAM } from "../helpers/composer-models.js";
import { makeTestRun } from "../helpers/make-run.js";
import { createTempHome } from "../helpers/temp-home.js";

const TEST_MODELS = [COMPOSER_25_WITH_FAST_PARAM];

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  setModelListForTesting(null);
  vi.unstubAllEnvs();
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("run-model", () => {
  it("formats run model display", () => {
    const output = formatRunModelDisplay(makeTestRun({ model: "gpt-5.2" }));

    expect(output).toContain("loops-improvement");
    expect(output).toContain("Model: gpt-5.2");
    expect(output).toContain("Provider: cursor");
  });

  it("sets model after validation", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    setModelListForTesting(TEST_MODELS);
    const paths = getStoragePaths(homeDir);

    const run = makeTestRun({ model: COMPOSER_25_FAST_ALIAS });
    await saveRun(run, paths);

    const updated = await setRunModel(run.id, "composer-2.5", paths);

    expect(updated.model).toBe("composer-2.5");

    const persisted = await getRun(run.id, paths);
    expect(persisted?.model).toBe("composer-2.5");

    const lines = await readRunLog(run.id, { tail: 5 }, paths);
    expect(lines.some((line) => line.includes("[model] updated to composer-2.5"))).toBe(
      true,
    );
  });

  it("rejects unknown models", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    setModelListForTesting(TEST_MODELS);
    const paths = getStoragePaths(homeDir);

    const run = makeTestRun();
    await saveRun(run, paths);

    await expect(setRunModel(run.id, "not-a-model", paths)).rejects.toThrow(
      'Unknown model "not-a-model"',
    );
  });

  it("rejects empty model", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    const paths = getStoragePaths(homeDir);

    const run = makeTestRun();
    await saveRun(run, paths);

    await expect(setRunModel(run.id, "   ", paths)).rejects.toThrow(
      "Model cannot be empty.",
    );
  });

  it("syncs model from disk without reloading other run state", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    const paths = getStoragePaths(homeDir);

    const run = makeTestRun({ model: COMPOSER_25_FAST_ALIAS, tasksCompleted: 2 });
    await saveRun(run, paths);

    run.model = COMPOSER_25_FAST_ALIAS;
    run.tasksCompleted = 2;

    const onDisk = await getRun(run.id, paths);
    onDisk!.model = DEFAULT_MODEL;
    onDisk!.tasksCompleted = 0;
    await saveRun(onDisk!, paths);

    await syncRunModelFromDisk(run, paths);

    expect(run.model).toBe(DEFAULT_MODEL);
    expect(run.tasksCompleted).toBe(2);
  });

  it("persistWorkerRun preserves disk model when memory is stale", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    const paths = getStoragePaths(homeDir);

    const run = makeTestRun({ model: DEFAULT_MODEL });
    await saveRun(run, paths);

    run.model = COMPOSER_25_FAST_ALIAS;
    run.tasksCompleted = 3;

    await persistWorkerRun(run, paths);

    const persisted = await readRunRaw(run.id, paths);
    expect(persisted?.model).toBe(DEFAULT_MODEL);
    expect(persisted?.tasksCompleted).toBe(3);
  });
});
