import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addLoop } from "../../src/core/registry.js";
import {
  getRun,
  listActiveRunsForLoop,
  startRun,
  stopRun,
} from "../../src/core/runner.js";
import { readRunLog } from "../../src/core/logs.js";
import { getStoragePaths } from "../../src/core/storage.js";
import {
  MockProvider,
  resetMockProviderIds,
  setProviderForTesting,
} from "../../src/providers/index.js";
import { setModelListForTesting } from "../../src/core/models.js";
import { executeWorker } from "../../src/core/worker.js";
import { COMPOSER_25_FAST_ALIAS } from "../../src/core/models.js";
import { DEFAULT_MODEL } from "../../src/constants.js";
import { COMPOSER_25_WITH_FAST_PARAM } from "../helpers/composer-models.js";
import { createTempHome } from "../helpers/temp-home.js";
import { setupTestRuntime } from "../helpers/test-runtime.js";

const TEST_MODELS = [
  COMPOSER_25_WITH_FAST_PARAM,
  { id: "gpt-5.2", displayName: "GPT-5.2" },
];

const cleanups: Array<() => Promise<void>> = [];

beforeEach(() => {
  vi.unstubAllEnvs();
  delete process.env.LOOPS_TEST_MODE;
  setupTestRuntime({ workerPid: 4242 });
  setModelListForTesting(TEST_MODELS);

  resetMockProviderIds();
  setProviderForTesting(new MockProvider({ runs: [{}, {}] }));
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

describe("runner", () => {
  it("starts a run and resolves prompt from inline flag", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);
    const repoPath = await setupRepo(homeDir);

    await addLoop({ name: "refactor", defaultPrompt: "default" }, paths);

    const run = await startRun(
      {
        loopName: "refactor",
        repoPath,
        prompt: "fix lint issues",
      },
      paths,
    );

    expect(run.id).toHaveLength(8);
    expect(run.prompt).toBe("fix lint issues");
    expect(run.status).toBe("running");
    expect(run.pid).toBe(4242);
    expect(run.continuous).toBe(true);
    expect(run.model).toBe(DEFAULT_MODEL);
  });

  it("uses run model flag and definition default", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);
    const repoPath = await setupRepo(homeDir);

    await addLoop(
      { name: "refactor", defaultPrompt: "default", defaultModel: "gpt-5.2" },
      paths,
    );

    const fromDefinition = await startRun(
      { loopName: "refactor", repoPath },
      paths,
    );
    expect(fromDefinition.model).toBe("gpt-5.2");

    const fromFlag = await startRun(
      {
        loopName: "refactor",
        repoPath,
        model: COMPOSER_25_FAST_ALIAS,
      },
      paths,
    );
    expect(fromFlag.model).toBe(COMPOSER_25_FAST_ALIAS);
  });

  it("rejects unknown models", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);
    const repoPath = await setupRepo(homeDir);

    await addLoop({ name: "refactor", defaultPrompt: "default" }, paths);

    await expect(
      startRun(
        {
          loopName: "refactor",
          repoPath,
          model: "not-a-real-model",
        },
        paths,
      ),
    ).rejects.toThrow('Unknown model "not-a-real-model"');
  });

  it("supports one-shot runs", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
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

    expect(run.continuous).toBe(false);
  });

  it("stops active runs by id prefix", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);
    const repoPath = await setupRepo(homeDir);

    await addLoop({ name: "refactor", defaultPrompt: "default" }, paths);
    const run = await startRun({ loopName: "refactor", repoPath }, paths);

    const stopped = await stopRun(run.id.slice(0, 4), paths);
    expect(stopped.status).toBe("stopped");
  });

  it("stops active runs by loop name", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);
    const repoPath = await setupRepo(homeDir);

    await addLoop({ name: "refactor", defaultPrompt: "default" }, paths);
    const run = await startRun({ loopName: "refactor", repoPath }, paths);

    const stopped = await stopRun("refactor", paths);
    expect(stopped.status).toBe("stopped");
    expect(stopped.id).toBe(run.id);
  });

  it("executes worker until once limit is reached", async () => {
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

    const active = await listActiveRunsForLoop("refactor", paths);
    expect(active).toHaveLength(0);
  });

  it("stops worker when task limit is reached", async () => {
    setProviderForTesting(
      new MockProvider({
        runs: [{}, {}, {}],
      }),
    );

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
        maxTasks: 2,
      },
      paths,
    );

    const exitCode = await executeWorker(run.id);
    expect(exitCode).toBe(0);

    const finished = await getRun(run.id, paths);
    expect(finished?.tasksCompleted).toBe(2);
    expect(finished?.status).toBe("finished");
  });

  it("writes log lines while executing tasks", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    const paths = getStoragePaths(homeDir);
    const repoPath = await setupRepo(homeDir);

    await addLoop({ name: "refactor", defaultPrompt: "default" }, paths);
    const run = await startRun(
      { loopName: "refactor", repoPath, once: true },
      paths,
    );

    await executeWorker(run.id);

    const lines = await readRunLog(run.id, { tail: 20 }, paths);
    expect(lines.some((line) => line.includes("[start] loop=refactor"))).toBe(
      true,
    );
    expect(lines.some((line) => line.includes("[task 1] finished"))).toBe(
      true,
    );
  });
});
