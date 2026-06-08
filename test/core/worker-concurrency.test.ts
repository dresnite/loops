import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addLoop } from "../../src/core/registry.js";
import { getRun, startRun } from "../../src/core/runner.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { executeWorker } from "../../src/core/worker.js";
import {
  MockProvider,
  resetMockProviderIds,
  setProviderForTesting,
} from "../../src/providers/index.js";
import { createTempHome } from "../helpers/temp-home.js";
import { setupTestRuntime } from "../helpers/test-runtime.js";

const cleanups: Array<() => Promise<void>> = [];

beforeEach(() => {
  vi.unstubAllEnvs();
  delete process.env.LOOPS_TEST_MODE;
  setupTestRuntime();
  resetMockProviderIds();
  setProviderForTesting(
    new MockProvider({
      runs: [{ rapidUsageCalls: 50 }],
    }),
  );
});

afterEach(async () => {
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
      },
      paths,
    );

    const exitCode = await executeWorker(run.id);
    expect(exitCode).toBe(0);

    const finished = await getRun(run.id, paths);
    expect(finished?.status).toBe("finished");
    expect(finished?.tasksCompleted).toBe(1);
    expect(finished?.usage.outputTokens).toBe(50);
  });
});
