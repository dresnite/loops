import { runCommand } from "citty";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import addCommand from "../../src/commands/add.js";
import lsCommand from "../../src/commands/ls.js";
import rmCommand from "../../src/commands/rm.js";
import runCommandDef from "../../src/commands/run.js";
import stopCommand from "../../src/commands/stop.js";
import {
  getRun,
  listRuns,
  resetWorkerSpawnerForTesting,
  setWorkerSpawnerForTesting,
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
  resetMockProviderIds();
  setProviderForTesting(new MockProvider({ runs: [{}] }));
  setWorkerSpawnerForTesting(() => ({ pid: 9001 }));
  vi.stubEnv("LOOPS_TEST_MODE", "1");
});

afterEach(async () => {
  resetWorkerSpawnerForTesting();
  setProviderForTesting(null);
  vi.unstubAllEnvs();
  delete process.env.LOOPS_TEST_MODE;
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

async function setup(homeDir: string): Promise<string> {
  vi.stubEnv("HOME", homeDir);
  const repoPath = join(homeDir, "repo");
  await mkdir(repoPath, { recursive: true });
  await writeFile(join(repoPath, "README.md"), "# demo", "utf8");
  return repoPath;
}

describe("loops run/ls/stop/rm", () => {
  it("runs, lists, stops, and removes loops", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const repoPath = await setup(homeDir);
    const paths = getStoragePaths(homeDir);

    await runCommand(addCommand, {
      rawArgs: ["refactor", "--prompt", "Improve structure"],
    });

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    try {
      await runCommand(runCommandDef, {
        rawArgs: [
          "refactor",
          "--repo",
          repoPath,
          "--budget",
          "10",
          "--tasks",
          "25",
        ],
      });

      expect(logs.some((line) => line.includes("Started loop"))).toBe(true);

      const runs = await listRuns(paths);
      const started = runs[0];
      expect(started?.status).toBe("running");

      await runCommand(lsCommand, { rawArgs: [] });
      expect(logs.some((line) => line.includes("refactor"))).toBe(true);

      await runCommand(stopCommand, {
        rawArgs: [started!.id.slice(0, 4)],
      });

      const stopped = await getRun(started!.id, paths);
      expect(stopped?.status).toBe("stopped");

      await runCommand(rmCommand, { rawArgs: ["refactor"] });
      expect(logs.some((line) => line.includes('Removed loop "refactor"'))).toBe(
        true,
      );
    } finally {
      console.log = originalLog;
    }
  });

  it("blocks removal when a run is active", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const repoPath = await setup(homeDir);

    await runCommand(addCommand, {
      rawArgs: ["refactor", "--prompt", "Improve structure"],
    });

    await runCommand(runCommandDef, {
      rawArgs: ["refactor", "--repo", repoPath],
    });

    await expect(
      runCommand(rmCommand, { rawArgs: ["refactor"] }),
    ).rejects.toThrow('Cannot remove "refactor" while runs are active');
  });

  it("finishes one-shot runs via worker", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const repoPath = await setup(homeDir);
    const paths = getStoragePaths(homeDir);

    await runCommand(addCommand, {
      rawArgs: ["refactor", "--prompt", "Improve structure"],
    });

    setWorkerSpawnerForTesting(() => ({ pid: 0 }));

    await runCommand(runCommandDef, {
      rawArgs: ["refactor", "--repo", repoPath, "--once"],
    });

    const run = (await listRuns(paths))[0]!;
    const exitCode = await executeWorker(run.id);
    expect(exitCode).toBe(0);

    const finished = await getRun(run.id, paths);
    expect(finished?.status).toBe("finished");
    expect(finished?.tasksCompleted).toBe(1);
  });
});
