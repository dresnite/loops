import { readdir, readFile } from "node:fs/promises";
import { join } from "pathe";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("worker script path", () => {
  it("bundled runner resolves worker.mjs in the same dist directory", async () => {
    const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
    const distDir = join(projectRoot, "dist");

    const entries = await readdir(distDir);
    const runner = entries.find(
      (entry) => entry.startsWith("runner-") && entry.endsWith(".mjs"),
    );
    expect(runner).toBeDefined();

    const runnerSource = await readFile(`${distDir}/${runner}`, "utf8");
    expect(runnerSource).toContain("function getWorkerScriptPath");
    expect(runnerSource).toMatch(/\.\/worker\.\$\{extension\}/);
    expect(runnerSource).not.toContain("../../worker.mjs");

    expect(entries).toContain("worker.mjs");
  });
});
