import { describe, expect, it } from "vitest";
import {
  formatToolActivity,
  StreamEventLogger,
  type StreamLogWriter,
} from "../../src/core/stream-log.js";

function createWriter(): StreamLogWriter & {
  lines: string[];
  blocks: Array<{ label: string; body: string }>;
} {
  const lines: string[] = [];
  const blocks: Array<{ label: string; body: string }> = [];

  return {
    lines,
    blocks,
    async writeLine(message: string) {
      lines.push(message);
    },
    async writeBlock(label: string, body: string) {
      blocks.push({ label, body });
    },
  };
}

describe("formatToolActivity", () => {
  it("maps common tools to friendly activity labels", () => {
    expect(formatToolActivity("read")).toBe("reading...");
    expect(formatToolActivity("shell")).toBe("running command...");
    expect(formatToolActivity("custom_tool")).toBe("using custom_tool...");
  });
});

describe("StreamEventLogger", () => {
  it("buffers assistant deltas and flushes as a block", async () => {
    const writer = createWriter();
    const logger = new StreamEventLogger(writer);

    await logger.handle({ type: "assistant", text: "I'll " });
    await logger.handle({ type: "assistant", text: "review " });
    await logger.handle({ type: "assistant", text: "the code." });
    await logger.flush();

    expect(writer.lines).toEqual([]);
    expect(writer.blocks).toEqual([
      { label: "[assistant]", body: "I'll review the code." },
    ]);
  });

  it("flushes assistant text before logging tool activity", async () => {
    const writer = createWriter();
    const logger = new StreamEventLogger(writer);

    await logger.handle({ type: "assistant", text: "Checking " });
    await logger.handle({ type: "assistant", text: "files." });
    await logger.handle({ type: "tool_call", toolName: "read" });

    expect(writer.blocks).toEqual([
      { label: "[assistant]", body: "Checking files." },
    ]);
    expect(writer.lines).toEqual(["[tool] reading..."]);
  });

  it("collapses consecutive identical tool calls into one line", async () => {
    const writer = createWriter();
    const logger = new StreamEventLogger(writer);

    await logger.handle({ type: "tool_call", toolName: "read" });
    await logger.handle({ type: "tool_call", toolName: "read" });
    await logger.handle({ type: "tool_call", toolName: "read" });
    await logger.handle({ type: "tool_call", toolName: "shell" });
    await logger.handle({ type: "tool_call", toolName: "shell" });

    expect(writer.lines).toEqual([
      "[tool] reading...",
      "[tool] running command...",
    ]);
  });

  it("treats tool names as case-insensitive when collapsing", async () => {
    const writer = createWriter();
    const logger = new StreamEventLogger(writer);

    await logger.handle({ type: "tool_call", toolName: "Read" });
    await logger.handle({ type: "tool_call", toolName: "READ" });
    await logger.handle({ type: "tool_call", toolName: " read " });

    expect(writer.lines).toEqual(["[tool] reading..."]);
  });

  it("starts a new tool series after assistant text", async () => {
    const writer = createWriter();
    const logger = new StreamEventLogger(writer);

    await logger.handle({ type: "tool_call", toolName: "read" });
    await logger.handle({ type: "assistant", text: "Done reviewing." });
    await logger.handle({ type: "tool_call", toolName: "read" });

    expect(writer.lines).toEqual([
      "[tool] reading...",
      "[tool] reading...",
    ]);
    expect(writer.blocks).toEqual([
      { label: "[assistant]", body: "Done reviewing." },
    ]);
  });

  it("does nothing when flushing an empty buffer", async () => {
    const writer = createWriter();
    const logger = new StreamEventLogger(writer);

    await logger.flush();

    expect(writer.lines).toEqual([]);
    expect(writer.blocks).toEqual([]);
  });

  it("ignores assistant events with empty text", async () => {
    const writer = createWriter();
    const logger = new StreamEventLogger(writer);

    await logger.handle({ type: "assistant", text: "   " });
    await logger.flush();

    expect(writer.blocks).toEqual([]);
  });
});
