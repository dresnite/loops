import { afterEach, describe, expect, it } from "vitest";
import {
  appendRunLog,
  formatAssistantLogText,
  readRunLog,
  truncateLogText,
} from "../../src/core/logs.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("logs", () => {
  it("appends and tails log lines", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);

    await appendRunLog("abc123", "[start] loop=test", paths);
    await appendRunLog("abc123", "[task 1] finished", paths);

    const lines = await readRunLog("abc123", { tail: 10 }, paths);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("[start] loop=test");
    expect(lines[1]).toContain("[task 1] finished");
  });

  it("truncates long log text", () => {
    expect(truncateLogText("a".repeat(250), 200)).toMatch(/\.\.\.$/);
  });

  it("allows longer assistant log text", () => {
    expect(formatAssistantLogText("a".repeat(250), 4000)).toBe("a".repeat(250));
    expect(formatAssistantLogText("a".repeat(4500), 4000)).toMatch(/\.\.\.$/);
  });

  it("appends multi-line assistant blocks", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);

    const { appendRunLogBlock } = await import("../../src/core/logs.js");
    await appendRunLogBlock("abc123", "[assistant]", "# Title\n\nBody", paths);

    const lines = await readRunLog("abc123", { tail: 10 }, paths);
    expect(lines[0]).toContain("[assistant]");
    expect(lines[1]).toBe("# Title");
    expect(lines[2]).toBe("");
    expect(lines[3]).toBe("Body");
  });
});
