import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addLoop } from "../../src/core/registry.js";
import { getRun, startRun } from "../../src/core/runner.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { setModelListForTesting } from "../../src/core/models.js";
import { executeWorker } from "../../src/core/worker.js";
import { COMPOSER_25_FAST_ALIAS } from "../../src/core/models.js";
import { COMPOSER_25_WITH_FAST_PARAM } from "../helpers/composer-models.js";
import {
  MockProvider,
  resetMockProviderIds,
  setProviderForTesting,
} from "../../src/providers/index.js";
import { createTempHome } from "../helpers/temp-home.js";
import { setupTestRuntime } from "../helpers/test-runtime.js";

const cleanups: Array<() => Promise<void>> = [];

let mockProvider: MockProvider;

beforeEach(() => {
  vi.unstubAllEnvs();
  delete process.env.LOOPS_TEST_MODE;
  setupTestRuntime();
  setModelListForTesting([COMPOSER_25_WITH_FAST_PARAM]);
  resetMockProviderIds();
  mockProvider = new MockProvider({
    runs: [{ rapidUsageCalls: 50 }],
  });
  setProviderForTesting(mockProvider);
});

afterEach(async () => {
  setModelListForTesting(null);
  setProviderForTesting(null);
  vi.unstubAllEnvs();
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

async function setupRepo(homeDir: string): Promise<string> {
  const repoPath = join(homeDir, "repo");
  await mkdir(repoPath, { recursive: true });
  await writeFile(join(repoPath, "README.md"), "# demo", "utf8");
  return repoPath;
}

describe("worker concurrency", () => {
  it("survives rapid usage updates without crashing", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);

    const paths = getStoragePaths(homeDir);
    const repoPath = await setupRepo(homeDir);

    await addLoop({ name: "refactor", defaultPrompt: "default" }, paths);
    const run = await startRun(
      {
        loopName: "refactor",
        repoPath,
        once: true,
        model: COMPOSER_25_FAST_ALIAS,
      },
      paths,
    );

    const exitCode = await executeWorker(run.id);
    expect(mockProvider.lastSessionOptions?.model).toBe(COMPOSER_25_FAST_ALIAS);
    expect(mockProvider.lastSessionOptions?.modelSelection).toEqual({
      id: "composer-2.5",
      params: [{ id: "fast", value: "true" }],
    });
    expect(mockProvider.sentPrompts).toHaveLength(1);
    expect(exitCode).toBe(0);

    const finished = await getRun(run.id, paths);
    expect(finished?.status).toBe("finished");
    expect(finished?.tasksCompleted).toBe(1);
    expect(finished?.usage.outputTokens).toBe(50);
  });
});
