import { join } from "pathe";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureStorageDirs,
  getStoragePaths,
  readJson,
  writeJsonAtomic,
} from "../../src/core/storage.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("storage", () => {
  it("writes and reads json atomically", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);

    const paths = getStoragePaths(homeDir);
    await ensureStorageDirs(paths);

    const filePath = join(paths.definitions, "demo.json");
    await writeJsonAtomic(filePath, { name: "demo" });

    const data = await readJson<{ name: string }>(filePath);
    expect(data).toEqual({ name: "demo" });
  });
});
