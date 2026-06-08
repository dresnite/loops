import { describe, expect, it } from "vitest";
import { formatAssistantLogText } from "../../src/core/logs.js";
import { StreamEventLogger } from "../../src/core/stream-log.js";

describe("formatAssistantLogText", () => {
  it("normalizes whitespace in assistant messages", () => {
    expect(formatAssistantLogText("I'll   review\n\nthe  code.")).toBe(
      "I'll review the code.",
    );
  });
});

describe("StreamEventLogger", () => {
  it("buffers assistant deltas and flushes as one line", async () => {
    const writes: string[] = [];
    const logger = new StreamEventLogger(async (message) => {
      writes.push(message);
    });

    await logger.handle({ type: "assistant", text: "I'll " });
    await logger.handle({ type: "assistant", text: "review " });
    await logger.handle({ type: "assistant", text: "the code." });
    await logger.flush();

    expect(writes).toEqual(["[assistant] I'll review the code."]);
  });

  it("flushes assistant text before logging tool calls", async () => {
    const writes: string[] = [];
    const logger = new StreamEventLogger(async (message) => {
      writes.push(message);
    });

    await logger.handle({ type: "assistant", text: "Checking " });
    await logger.handle({ type: "assistant", text: "files." });
    await logger.handle({ type: "tool_call", toolName: "read" });

    expect(writes).toEqual(["[assistant] Checking files.", "[tool] read"]);
  });

  it("does nothing when flushing an empty buffer", async () => {
    const writes: string[] = [];
    const logger = new StreamEventLogger(async (message) => {
      writes.push(message);
    });

    await logger.flush();

    expect(writes).toEqual([]);
  });

  it("ignores assistant events with empty text", async () => {
    const writes: string[] = [];
    const logger = new StreamEventLogger(async (message) => {
      writes.push(message);
    });

    await logger.handle({ type: "assistant", text: "   " });
    await logger.flush();

    expect(writes).toEqual([]);
  });
});
