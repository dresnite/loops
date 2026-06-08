import { readFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cursorApiKeyMissingMessage,
  getCursorApiKey,
  listConfiguredProviders,
  maskApiKey,
  requireCursorApiKey,
  setProviderKey,
} from "../../src/core/credentials.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("credentials", () => {
  it("stores and reads cursor api keys", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);

    await setProviderKey("cursor", "cursor_test_key_123", paths);

    const apiKey = await getCursorApiKey(paths);
    expect(apiKey).toBe("cursor_test_key_123");

    const listed = await listConfiguredProviders(paths);
    expect(listed).toEqual([
      { provider: "cursor", masked: maskApiKey("cursor_test_key_123") },
    ]);
  });

  it("prefers CURSOR_API_KEY env override", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    vi.stubEnv("CURSOR_API_KEY", "cursor_from_env");
    const paths = getStoragePaths(homeDir);

    await setProviderKey("cursor", "cursor_stored", paths);

    expect(await getCursorApiKey(paths)).toBe("cursor_from_env");
  });

  it("requires a configured key", async () => {
    vi.unstubAllEnvs();
    delete process.env.LOOPS_TEST_MODE;

    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);

    await expect(requireCursorApiKey(paths)).rejects.toThrow(
      cursorApiKeyMissingMessage(),
    );
  });

  it("writes credentials with restricted permissions", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);

    await setProviderKey("cursor", "cursor_secret", paths);

    const raw = await readFile(join(paths.root, "credentials.json"), "utf8");
    expect(JSON.parse(raw)).toMatchObject({ cursor: "cursor_secret" });
  });
});
