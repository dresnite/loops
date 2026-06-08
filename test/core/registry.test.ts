import { afterEach, describe, expect, it } from "vitest";
import {
  addLoop,
  getLoop,
  listLoops,
  removeLoop,
} from "../../src/core/registry.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("registry", () => {
  it("adds, lists, and removes loop definitions", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);

    const created = await addLoop(
      {
        name: "refactor",
        description: "Refactor code",
        defaultPrompt: "Improve structure",
      },
      paths,
    );

    expect(created.name).toBe("refactor");
    expect(await getLoop("refactor", paths)).toMatchObject({
      name: "refactor",
      defaultPrompt: "Improve structure",
    });

    const listed = await listLoops(paths);
    expect(listed).toHaveLength(1);

    await removeLoop("refactor", paths);
    expect(await getLoop("refactor", paths)).toBeNull();
  });

  it("rejects duplicate definitions", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);

    await addLoop({ name: "refactor" }, paths);
    await expect(addLoop({ name: "refactor" }, paths)).rejects.toThrow(
      'Loop definition "refactor" already exists',
    );
  });
});
