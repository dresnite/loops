import { execa } from "execa";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTempHome } from "../helpers/temp-home.js";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const cleanups: Array<() => Promise<void>> = [];

beforeAll(async () => {
  await execa("npm", ["run", "build"], { cwd: projectRoot });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("public api", () => {
  it("exports core helpers from the built package", async () => {
    const mod = await import("../../dist/index.mjs");

    expect(mod.addLoop).toBeTypeOf("function");
    expect(mod.startRun).toBeTypeOf("function");
    expect(mod.setProviderKey).toBeTypeOf("function");
    expect(mod.requireCursorApiKey).toBeTypeOf("function");
    expect(mod.SUPPORTED_PROVIDERS).toContain("cursor");
  });

  it("runs key set and list through the built cli", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);

    const env = { ...process.env, HOME: homeDir };
    const cliPath = join(projectRoot, "dist/cli.mjs");

    const set = await execa(
      "node",
      [cliPath, "key", "set", "cursor", "cursor_integration_test_key"],
      { env },
    );
    expect(set.stdout).toContain("Saved cursor API key");

    const list = await execa("node", [cliPath, "key", "list"], { env });
    expect(list.stdout).toContain("cursor:");
    expect(list.stdout).toContain("stored");
    expect(list.stdout).not.toContain("Providers:");
  });
});
