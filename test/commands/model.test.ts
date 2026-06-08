import { runCommand } from "citty";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import modelShowCommand from "../../src/commands/model-show.js";
import modelSetCommand from "../../src/commands/model-set.js";
import { addLoop } from "../../src/core/registry.js";
import { setModelListForTesting } from "../../src/core/models.js";
import { startRun, setWorkerSpawnerForTesting } from "../../src/core/runner.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { MockProvider, setProviderForTesting } from "../../src/providers/index.js";
import { DEFAULT_MODEL } from "../../src/constants.js";
import { createTempHome } from "../helpers/temp-home.js";

const TEST_MODELS = [
  { id: "composer-2.5", displayName: "Composer 2.5", aliases: [] },
  { id: "composer-2.5-fast", displayName: "Composer 2.5 Fast", aliases: [] },
];

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  setProviderForTesting(null);
  setModelListForTesting(null);
  vi.unstubAllEnvs();
  delete process.env.LOOPS_TEST_MODE;
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("loops model", () => {
  it("shows the model for a run", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    vi.stubEnv("LOOPS_TEST_MODE", "1");
    setModelListForTesting(TEST_MODELS);

    const paths = getStoragePaths(homeDir);
    const repoPath = join(homeDir, "repo");
    await mkdir(repoPath, { recursive: true });
    await writeFile(join(repoPath, "README.md"), "# demo", "utf8");

    setProviderForTesting(new MockProvider());
    setWorkerSpawnerForTesting(() => ({ pid: 0 }));

    await addLoop(
      { name: "structure-agent", defaultPrompt: "Improve structure" },
      paths,
    );
    await startRun(
      {
        loopName: "structure-agent",
        repoPath,
        model: "composer-2.5-fast",
      },
      paths,
    );

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join("\n"));
    };

    try {
      await runCommand(modelShowCommand, {
        rawArgs: ["structure-agent"],
      });
    } finally {
      console.log = originalLog;
    }

    const output = logs.join("\n");
    expect(output).toContain("structure-agent");
    expect(output).toContain("Model: composer-2.5-fast");
    expect(output).toContain("Provider: cursor");
  });

  it("sets the model for a run", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("HOME", homeDir);
    vi.stubEnv("LOOPS_TEST_MODE", "1");
    setModelListForTesting(TEST_MODELS);

    const paths = getStoragePaths(homeDir);
    const repoPath = join(homeDir, "repo");
    await mkdir(repoPath, { recursive: true });
    await writeFile(join(repoPath, "README.md"), "# demo", "utf8");

    setProviderForTesting(new MockProvider());
    setWorkerSpawnerForTesting(() => ({ pid: 0 }));

    await addLoop(
      { name: "structure-agent", defaultPrompt: "Improve structure" },
      paths,
    );
    const run = await startRun(
      {
        loopName: "structure-agent",
        repoPath,
        model: "composer-2.5-fast",
      },
      paths,
    );

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    try {
      await runCommand(modelSetCommand, {
        rawArgs: ["structure-agent", "--model", DEFAULT_MODEL],
      });
    } finally {
      console.log = originalLog;
    }

    expect(
      logs.some((line) =>
        line.includes(`Updated model for run ${run.id}`) &&
        line.includes(`to ${DEFAULT_MODEL}`),
      ),
    ).toBe(true);

    const showLogs: string[] = [];
    console.log = (...args: unknown[]) => {
      showLogs.push(args.map(String).join("\n"));
    };

    try {
      await runCommand(modelShowCommand, {
        rawArgs: [run.id],
      });
    } finally {
      console.log = originalLog;
    }

    expect(showLogs.join("\n")).toContain(`Model: ${DEFAULT_MODEL}`);
  });
});
