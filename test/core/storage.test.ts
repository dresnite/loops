import { join } from "pathe";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureStorageDirs,
  getStoragePaths,
  readJson,
  resetWriteQueuesForTesting,
  writeJsonAtomic,
} from "../../src/core/storage.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  resetWriteQueuesForTesting();
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

  it("handles concurrent writes to the same file", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);

    const paths = getStoragePaths(homeDir);
    await ensureStorageDirs(paths);

    const filePath = join(paths.definitions, "concurrent.json");
    const writes = Array.from({ length: 25 }, (_, index) =>
      writeJsonAtomic(filePath, { count: index }),
    );

    await expect(Promise.all(writes)).resolves.toBeDefined();

    const data = await readJson<{ count: number }>(filePath);
    expect(data).toEqual({ count: 24 });
  });
});
