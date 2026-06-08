import { runCommand } from "citty";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import logsCommand from "../../src/commands/logs.js";
import { appendRunLog } from "../../src/core/logs.js";
import { startRun, setWorkerSpawnerForTesting } from "../../src/core/runner.js";
import { addLoop } from "../../src/core/registry.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { MockProvider, setProviderForTesting } from "../../src/providers/index.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  setProviderForTesting(null);
  vi.unstubAllEnvs();
  delete process.env.LOOPS_TEST_MODE;
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("loops logs", () => {
  it("shows logs for a loop name", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    vi.stubEnv("LOOPS_TEST_MODE", "1");

    const paths = getStoragePaths(homeDir);
    const repoPath = join(homeDir, "repo");
    await mkdir(repoPath, { recursive: true });
    await writeFile(join(repoPath, "README.md"), "# demo", "utf8");

    setProviderForTesting(new MockProvider());
    setWorkerSpawnerForTesting(() => ({ pid: 0 }));

    await addLoop({ name: "structure-agent", defaultPrompt: "Improve" }, paths);
    const run = await startRun(
      { loopName: "structure-agent", repoPath, once: true },
      paths,
    );

    await appendRunLog(run.id, "[task 1] finished", paths);

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    try {
      await runCommand(logsCommand, {
        rawArgs: ["structure-agent", "--lines", "10"],
      });
    } finally {
      console.log = originalLog;
    }

    expect(logs.some((line) => line.includes("status: running"))).toBe(true);
    expect(logs.some((line) => line.includes("[task 1] finished"))).toBe(true);
  });
});
