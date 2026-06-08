import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setProcessAliveCheckerForTesting } from "../../src/core/process.js";
import { readRunLog } from "../../src/core/logs.js";
import { addLoop } from "../../src/core/registry.js";
import { startRun } from "../../src/core/runner.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { executeWorker } from "../../src/core/worker.js";
import {
  MockProvider,
  resetMockProviderIds,
  setProviderForTesting,
} from "../../src/providers/index.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

beforeEach(() => {
  vi.unstubAllEnvs();
  delete process.env.LOOPS_TEST_MODE;
  setProcessAliveCheckerForTesting(() => true);
  resetMockProviderIds();
  setProviderForTesting(
    new MockProvider({
      runs: [
        {
          assistantDeltas: ["I'll ", "review ", "the ", "code."],
          toolCalls: ["read"],
        },
      ],
    }),
  );
});

afterEach(async () => {
  setProcessAliveCheckerForTesting(null);
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

describe("worker stream logging", () => {
  it("coalesces assistant deltas into one log line", async () => {
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

    await executeWorker(run.id);

    const lines = await readRunLog(run.id, { tail: 20 }, paths);
    const assistantLines = lines.filter((line) => line.includes("[assistant]"));
    const toolLines = lines.filter((line) => line.includes("[tool]"));

    expect(assistantLines).toHaveLength(1);
    expect(assistantLines[0]).toContain("[assistant] I'll review the code.");
    expect(toolLines).toHaveLength(1);
    expect(toolLines[0]).toContain("[tool] read");
  });
});
