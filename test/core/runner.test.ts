import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addLoop } from "../../src/core/registry.js";
import {
  findRunByPrefix,
  getRun,
  listActiveRunsForLoop,
  setWorkerSpawnerForTesting,
  resetWorkerSpawnerForTesting,
  startRun,
  stopRun,
} from "../../src/core/runner.js";
import { getStoragePaths } from "../../src/core/storage.js";
import {
  MockProvider,
  resetMockProviderIds,
  setProviderForTesting,
} from "../../src/providers/index.js";
import { executeWorker } from "../../src/core/worker.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

beforeEach(() => {
  vi.unstubAllEnvs();
  delete process.env.LOOPS_TEST_MODE;

  resetMockProviderIds();
  setProviderForTesting(new MockProvider({ runs: [{}, {}] }));
  setWorkerSpawnerForTesting(() => ({ pid: 4242 }));
});

afterEach(async () => {
  resetWorkerSpawnerForTesting();
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

  it("finds runs by unique prefix", () => {
    const match = findRunByPrefix(
      [
        {
          id: "a1b2c3d4",
        } as never,
      ],
      "a1b2",
    );

    expect(match?.id).toBe("a1b2c3d4");
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
});
