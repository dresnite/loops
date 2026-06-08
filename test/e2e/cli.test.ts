import { execa } from "execa";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTempHome } from "../helpers/temp-home.js";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const cliPath = join(projectRoot, "dist/cli.mjs");
const workerPath = join(projectRoot, "dist/worker.mjs");
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("loops e2e", () => {
  it("prints provider roadmap in help output", async () => {
    const { stdout } = await execa("node", [cliPath, "--help"]);
    expect(stdout).toContain("cursor");
    expect(stdout).toContain("claude-code");
  });

  it("runs add, run, ls, stop, and rm against built cli", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);

    const repoPath = join(homeDir, "repo");
    await mkdir(repoPath, { recursive: true });
    await writeFile(join(repoPath, "README.md"), "# demo", "utf8");

    const env = {
      ...process.env,
      HOME: homeDir,
      LOOPS_TEST_MODE: "1",
    };

    const add = await execa(
      "node",
      [
        cliPath,
        "add",
        "refactor",
        "--description",
        "Refactor",
        "--prompt",
        "Improve structure",
      ],
      { env },
    );
    expect(add.stdout).toContain('Created loop "refactor"');

    const run = await execa(
      "node",
      [cliPath, "run", "refactor", "--repo", repoPath, "--once"],
      { env },
    );
    const runIdMatch = run.stdout.match(/run-id: ([a-f0-9]+)/);
    expect(runIdMatch).not.toBeNull();

    await execa("node", [workerPath, runIdMatch![1]!], { env });

    const ls = await execa("node", [cliPath, "ls"], { env });
    expect(ls.stdout).toContain("No running loops");

    const runAgain = await execa(
      "node",
      [cliPath, "run", "refactor", "--repo", repoPath, "--once"],
      { env },
    );
    const activeRunId = runAgain.stdout.match(/run-id: ([a-f0-9]+)/)?.[1];
    expect(activeRunId).toBeTruthy();

    await execa("node", [cliPath, "stop", activeRunId!.slice(0, 4)], { env });

    const rm = await execa("node", [cliPath, "rm", "refactor"], { env });
    expect(rm.stdout).toContain('Removed loop "refactor"');
  });
});
