import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASSISTANT_LOG_LABEL, readRunLog } from "../../src/core/logs.js";
import { addLoop } from "../../src/core/registry.js";
import { startRun } from "../../src/core/runner.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { setModelListForTesting } from "../../src/core/models.js";
import { executeWorker } from "../../src/core/worker.js";
import { COMPOSER_25_WITH_FAST_PARAM } from "../helpers/composer-models.js";
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
  setModelListForTesting([COMPOSER_25_WITH_FAST_PARAM]);
  resetMockProviderIds();
  setProviderForTesting(
    new MockProvider({
      runs: [
        {
          assistantDeltas: ["I'll ", "review ", "the ", "code."],
          toolCalls: ["read", "read", "read", "shell"],
        },
      ],
    }),
  );
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
    const assistantHeader = lines.find((line) =>
      line.includes(ASSISTANT_LOG_LABEL),
    );
    const assistantBody = lines.find((line) => line.includes("I'll review the code."));
    const toolLines = lines.filter((line) => line.includes("[tool]"));

    expect(assistantHeader).toBeDefined();
    expect(assistantBody).toBe("I'll review the code.");
    expect(toolLines).toHaveLength(2);
    expect(toolLines[0]).toContain("[tool] reading...");
    expect(toolLines[1]).toContain("[tool] running command...");
  });
});
