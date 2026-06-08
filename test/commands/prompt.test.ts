import { runCommand } from "citty";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import promptShowCommand from "../../src/commands/prompt-show.js";
import promptSetCommand from "../../src/commands/prompt-set.js";
import { addLoop } from "../../src/core/registry.js";
import { startRun, setWorkerSpawnerForTesting } from "../../src/core/runner.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { setModelListForTesting } from "../../src/core/models.js";
import { MockProvider, setProviderForTesting } from "../../src/providers/index.js";
import { DEFAULT_MODEL } from "../../src/constants.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  setProviderForTesting(null);
  setModelListForTesting(null);
  vi.unstubAllEnvs();
  delete process.env.LOOPS_TEST_MODE;
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("loops prompt", () => {
  it("shows the prompt for a run", async () => {
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

    await addLoop(
      { name: "structure-agent", defaultPrompt: "Improve structure" },
      paths,
    );
    await startRun(
      {
        loopName: "structure-agent",
        repoPath,
        prompt: "fix lint issues",
      },
      paths,
    );

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join("\n"));
    };

    try {
      await runCommand(promptShowCommand, {
        rawArgs: ["structure-agent"],
      });
    } finally {
      console.log = originalLog;
    }

    const output = logs.join("\n");
    expect(output).toContain("structure-agent");
    expect(output).toContain(`Model: ${DEFAULT_MODEL}`);
    expect(output).toContain("fix lint issues");
  });

  it("sets the prompt for a run", async () => {
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

    await addLoop(
      { name: "structure-agent", defaultPrompt: "Improve structure" },
      paths,
    );
    const run = await startRun(
      { loopName: "structure-agent", repoPath },
      paths,
    );

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    try {
      await runCommand(promptSetCommand, {
        rawArgs: ["structure-agent", "--prompt", "new instructions"],
      });
    } finally {
      console.log = originalLog;
    }

    expect(logs.some((line) => line.includes(`Updated prompt for run ${run.id}`))).toBe(
      true,
    );

    const showLogs: string[] = [];
    console.log = (...args: unknown[]) => {
      showLogs.push(args.map(String).join("\n"));
    };

    try {
      await runCommand(promptShowCommand, {
        rawArgs: [run.id],
      });
    } finally {
      console.log = originalLog;
    }

    expect(showLogs.join("\n")).toContain("new instructions");
  });
});
