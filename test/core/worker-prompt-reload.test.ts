import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setModelListForTesting } from "../../src/core/models.js";
import { setRunPrompt } from "../../src/core/run-prompt.js";
import { addLoop } from "../../src/core/registry.js";
import { getRun, startRun } from "../../src/core/runner.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { executeWorker } from "../../src/core/worker.js";
import { DEFAULT_MODEL } from "../../src/constants.js";
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
  setModelListForTesting([{ id: DEFAULT_MODEL, displayName: "Composer 2.5" }]);
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

async function waitForSentPromptCount(count: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (mockProvider.sentPrompts.length === count) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(
    `Timed out waiting for ${count} sent prompts (got ${mockProvider.sentPrompts.length})`,
  );
}

describe("worker prompt reload", () => {
  it("uses an updated prompt on the next task of a continuous run", async () => {
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
        prompt: "first prompt",
        maxTasks: 2,
      },
      paths,
    );

    const workerPromise = executeWorker(run.id);

    await waitForSentPromptCount(1);
    expect(mockProvider.sentPrompts[0]).toBe("first prompt");

    await setRunPrompt(run.id, { prompt: "second prompt" }, paths);

    const exitCode = await workerPromise;
    expect(exitCode).toBe(0);
    expect(mockProvider.sentPrompts).toEqual([
      "first prompt",
      "second prompt",
    ]);

    const finished = await getRun(run.id, paths);
    expect(finished?.tasksCompleted).toBe(2);
    expect(finished?.prompt).toBe("second prompt");
  });

  it("preserves prompt set during an in-flight task", async () => {
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
        prompt: "first prompt",
        maxTasks: 2,
      },
      paths,
    );

    mockProvider = new MockProvider({
      runs: [{ delayMs: 200, rapidUsageCalls: 5 }, {}],
    });
    setProviderForTesting(mockProvider);

    const workerPromise = executeWorker(run.id);

    await waitForSentPromptCount(1);
    expect(mockProvider.sentPrompts[0]).toBe("first prompt");

    await setRunPrompt(run.id, { prompt: "second prompt" }, paths);

    const exitCode = await workerPromise;
    expect(exitCode).toBe(0);
    expect(mockProvider.sentPrompts).toEqual([
      "first prompt",
      "second prompt",
    ]);

    const finished = await getRun(run.id, paths);
    expect(finished?.prompt).toBe("second prompt");
  });
});
