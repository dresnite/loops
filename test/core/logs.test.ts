import { appendFile, readFile, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendRunLog,
  appendRunLogBlock,
  ASSISTANT_LOG_LABEL,
  FOLLOW_POLL_MS,
  formatAssistantLogText,
  formatLogHeader,
  followRunLog,
  isAssistantHeaderLine,
  isLogHeaderLine,
  logHeaderLabel,
  readLogFileDelta,
  readRunLog,
  runLogPath,
  splitIncomingLogText,
  truncateLogText,
} from "../../src/core/logs.js";
import { getStoragePaths } from "../../src/core/storage.js";
import { createTempHome } from "../helpers/temp-home.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups.length = 0;
});

describe("log format", () => {
  it("writes and detects timestamped header lines", () => {
    const header = formatLogHeader(
      ASSISTANT_LOG_LABEL,
      new Date("2026-06-08T15:14:48.516Z"),
    );

    expect(header).toBe("2026-06-08T15:14:48.516Z [assistant]");
    expect(isLogHeaderLine(header)).toBe(true);
    expect(logHeaderLabel(header)).toBe(ASSISTANT_LOG_LABEL);
    expect(isAssistantHeaderLine(header)).toBe(true);
    expect(isAssistantHeaderLine("plain text")).toBe(false);
    expect(logHeaderLabel("plain text")).toBeNull();
    expect(isAssistantHeaderLine(formatLogHeader("[task 1] finished"))).toBe(
      false,
    );
    expect(
      isAssistantHeaderLine(formatLogHeader("[backup assistant]")),
    ).toBe(false);
  });

  it("reads appended file deltas without dropping partial lines", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);
    const filePath = runLogPath(paths, "abc123");

    await appendRunLog("abc123", "[start] existing", paths);

    const initial = await readFile(filePath);
    let state = { offset: initial.length, partialLine: "" };

    const partialHeader = formatLogHeader(
      "[partial",
      new Date("2026-06-08T15:14:48.516Z"),
    );
    await appendFile(filePath, partialHeader, "utf8");
    const afterPartial = await readFile(filePath);
    expect(readLogFileDelta(afterPartial, state)).toEqual({
      offset: afterPartial.length,
      partialLine: partialHeader,
      completeLines: [],
    });
    state = readLogFileDelta(afterPartial, state);

    await appendFile(filePath, " line]\n", "utf8");
    const afterComplete = await readFile(filePath);
    expect(readLogFileDelta(afterComplete, state)).toEqual({
      offset: afterComplete.length,
      partialLine: "",
      completeLines: ["2026-06-08T15:14:48.516Z [partial line]"],
    });
  });

  it("resets follow state when the log file shrinks", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);
    const filePath = runLogPath(paths, "abc123");

    await appendRunLog("abc123", "[start] existing", paths);
    const full = await readFile(filePath);

    const truncated = Buffer.from("", "utf8");
    expect(
      readLogFileDelta(truncated, {
        offset: full.length,
        partialLine: "unfinished",
      }),
    ).toEqual({
      offset: 0,
      partialLine: "",
      completeLines: [],
    });
  });

  it("splits complete and partial lines from appended log text", () => {
    expect(splitIncomingLogText("", "")).toEqual({
      partialLine: "",
      completeLines: [],
    });

    expect(splitIncomingLogText("", "\n")).toEqual({
      partialLine: "",
      completeLines: [""],
    });

    expect(splitIncomingLogText("", "line one\nline two\n")).toEqual({
      partialLine: "",
      completeLines: ["line one", "line two"],
    });

    expect(splitIncomingLogText("2026-06-08T15:14:48.516Z [partial", " line]\n")).toEqual({
      partialLine: "",
      completeLines: ["2026-06-08T15:14:48.516Z [partial line]"],
    });

    expect(splitIncomingLogText("", "still writing")).toEqual({
      partialLine: "still writing",
      completeLines: [],
    });

    expect(splitIncomingLogText("still ", "writing")).toEqual({
      partialLine: "still writing",
      completeLines: [],
    });
  });
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

  it("preserves markdown line breaks in assistant log text", () => {
    expect(formatAssistantLogText("# Title\n\n- one\n- two")).toBe(
      "# Title\n\n- one\n- two",
    );
  });

  it("trims trailing spaces per line without collapsing paragraphs", () => {
    expect(formatAssistantLogText("line one  \n\nline two  ")).toBe(
      "line one\n\nline two",
    );
  });

  it("allows longer assistant log text", () => {
    expect(formatAssistantLogText("a".repeat(250), 4000)).toBe("a".repeat(250));
    expect(formatAssistantLogText("a".repeat(4500), 4000)).toMatch(/\.\.\.$/);
  });

  it("appends multi-line assistant blocks", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);

    await appendRunLogBlock("abc123", ASSISTANT_LOG_LABEL, "# Title\n\nBody", paths);

    const lines = await readRunLog("abc123", { tail: 10 }, paths);
    expect(lines[0]).toContain(ASSISTANT_LOG_LABEL);
    expect(lines[1]).toBe("# Title");
    expect(lines[2]).toBe("");
    expect(lines[3]).toBe("Body");
  });
});

describe("followRunLog", () => {
  async function waitForFollowPolls(count = 1): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, FOLLOW_POLL_MS * count + 50);
    });
  }

  it("starts at the end of an existing log file", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);

    await appendRunLog("abc123", "[start] existing", paths);

    const received: string[] = [];
    const stop = await followRunLog("abc123", (line) => received.push(line), paths);
    await waitForFollowPolls();

    expect(received).toEqual([]);
    stop();
  });

  it("emits newly appended lines", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);

    await appendRunLog("abc123", "[start] existing", paths);

    const received: string[] = [];
    const stop = await followRunLog("abc123", (line) => received.push(line), paths);
    await waitForFollowPolls();

    await appendRunLog("abc123", "[task 1] finished", paths);
    await waitForFollowPolls();

    expect(received).toHaveLength(1);
    expect(received[0]).toContain("[task 1] finished");
    stop();
  });

  it("buffers partial lines across reads", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);
    const filePath = runLogPath(paths, "abc123");

    await appendRunLog("abc123", "[start] existing", paths);

    const received: string[] = [];
    const stop = await followRunLog("abc123", (line) => received.push(line), paths);
    await waitForFollowPolls();

    await appendFile(filePath, `${formatLogHeader("[partial")}`, "utf8");
    await waitForFollowPolls();
    expect(received).toEqual([]);

    await appendFile(filePath, " line]\n", "utf8");
    await waitForFollowPolls();

    expect(received).toHaveLength(1);
    expect(received[0]).toContain("[partial line]");
    stop();
  });

  it("stops emitting lines after follow is cancelled", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);

    await appendRunLog("abc123", "[start] existing", paths);

    const received: string[] = [];
    const stop = await followRunLog("abc123", (line) => received.push(line), paths);
    await waitForFollowPolls();
    stop();

    await appendRunLog("abc123", "[after stop] ignored", paths);
    await waitForFollowPolls();

    expect(received).toEqual([]);
  });

  it("recovers when the log file is truncated", async () => {
    const { homeDir, cleanup } = await createTempHome();
    cleanups.push(cleanup);
    const paths = getStoragePaths(homeDir);
    const filePath = runLogPath(paths, "abc123");

    await appendRunLog("abc123", "[start] existing", paths);

    const received: string[] = [];
    const stop = await followRunLog("abc123", (line) => received.push(line), paths);
    await waitForFollowPolls();

    await writeFile(filePath, "", "utf8");
    await waitForFollowPolls();

    await appendRunLog("abc123", "[after truncate] fresh", paths);
    await waitForFollowPolls();

    expect(received).toHaveLength(1);
    expect(received[0]).toContain("[after truncate] fresh");
    stop();
  });
});
