import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setModelListForTesting } from "../../src/core/models.js";
import { setRunModel } from "../../src/core/run-model.js";
import { addLoop } from "../../src/core/registry.js";
import { getRun, startRun } from "../../src/core/runner.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { executeWorker } from "../../src/core/worker.js";
import { DEFAULT_MODEL } from "../../src/constants.js";
import { COMPOSER_25_FAST_ALIAS } from "../../src/core/models.js";
import {
  MockProvider,
  resetMockProviderIds,
  setProviderForTesting,
} from "../../src/providers/index.js";
import { COMPOSER_25_WITH_FAST_PARAM } from "../helpers/composer-models.js";
import { createTempHome } from "../helpers/temp-home.js";
import { setupTestRuntime } from "../helpers/test-runtime.js";

const TEST_MODELS = [COMPOSER_25_WITH_FAST_PARAM];

const cleanups: Array<() => Promise<void>> = [];
let mockProvider: MockProvider;

beforeEach(() => {
  vi.unstubAllEnvs();
  delete process.env.LOOPS_TEST_MODE;
  setupTestRuntime();
  setModelListForTesting(TEST_MODELS);
  resetMockProviderIds();
  mockProvider = new MockProvider({ runs: [{}, {}] });
  setProviderForTesting(mockProvider);
});

afterEach(async () => {
  setModelListForTesting(null);
  setProviderForTesting(null);
  vi.unstubAllEnvs();
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

async function waitForSessionCount(count: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (mockProvider.sessionModels.length === count) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(
    `Timed out waiting for ${count} sessions (got ${mockProvider.sessionModels.length})`,
  );
}

describe("worker model reload", () => {
  it("pins composer-2.5 to the standard tier when a run starts", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    const paths = getStoragePaths(homeDir);

    const repoPath = join(homeDir, "repo");
    await mkdir(repoPath, { recursive: true });
    await writeFile(join(repoPath, "README.md"), "# demo", "utf8");

    await addLoop({ name: "refactor", defaultPrompt: "default" }, paths);
    const run = await startRun(
      {
        loopName: "refactor",
        repoPath,
        once: true,
      },
      paths,
    );

    const exitCode = await executeWorker(run.id);
    expect(exitCode).toBe(0);
    expect(mockProvider.sessionModelSelections[0]).toEqual({
      id: "composer-2.5",
      params: [{ id: "fast", value: "false" }],
    });
  });

  it("uses an updated model on the next task of a continuous run", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    const paths = getStoragePaths(homeDir);

    const repoPath = join(homeDir, "repo");
    await mkdir(repoPath, { recursive: true });
    await writeFile(join(repoPath, "README.md"), "# demo", "utf8");

    await addLoop({ name: "refactor", defaultPrompt: "default" }, paths);
    const run = await startRun(
      {
        loopName: "refactor",
        repoPath,
        model: COMPOSER_25_FAST_ALIAS,
        maxTasks: 2,
      },
      paths,
    );

    const workerPromise = executeWorker(run.id);

    await waitForSessionCount(1);
    expect(mockProvider.sessionModels[0]).toBe("composer-2.5");
    expect(mockProvider.sessionModelSelections[0]).toEqual({
      id: "composer-2.5",
      params: [{ id: "fast", value: "true" }],
    });

    await setRunModel(run.id, DEFAULT_MODEL, paths);

    const exitCode = await workerPromise;
    expect(exitCode).toBe(0);
    expect(mockProvider.sessionModels).toEqual(["composer-2.5", "composer-2.5"]);
    expect(mockProvider.sessionModelSelections[1]).toEqual({
      id: "composer-2.5",
      params: [{ id: "fast", value: "false" }],
    });

    const finished = await getRun(run.id, paths);
    expect(finished?.tasksCompleted).toBe(2);
    expect(finished?.model).toBe(DEFAULT_MODEL);
  });

  it("preserves model set during an in-flight task", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    const paths = getStoragePaths(homeDir);

    const repoPath = join(homeDir, "repo");
    await mkdir(repoPath, { recursive: true });
    await writeFile(join(repoPath, "README.md"), "# demo", "utf8");

    await addLoop({ name: "refactor", defaultPrompt: "default" }, paths);
    const run = await startRun(
      {
        loopName: "refactor",
        repoPath,
        model: COMPOSER_25_FAST_ALIAS,
        maxTasks: 2,
      },
      paths,
    );

    mockProvider = new MockProvider({
      runs: [{ delayMs: 200, rapidUsageCalls: 5 }, {}],
    });
    setProviderForTesting(mockProvider);

    const workerPromise = executeWorker(run.id);

    await waitForSessionCount(1);
    expect(mockProvider.sessionModels[0]).toBe("composer-2.5");
    expect(mockProvider.sessionModelSelections[0]).toEqual({
      id: "composer-2.5",
      params: [{ id: "fast", value: "true" }],
    });

    await setRunModel(run.id, DEFAULT_MODEL, paths);

    const exitCode = await workerPromise;
    expect(exitCode).toBe(0);
    expect(mockProvider.sessionModels).toEqual(["composer-2.5", "composer-2.5"]);
    expect(mockProvider.sessionModelSelections[1]).toEqual({
      id: "composer-2.5",
      params: [{ id: "fast", value: "false" }],
    });

    const finished = await getRun(run.id, paths);
    expect(finished?.model).toBe(DEFAULT_MODEL);
  });
});
