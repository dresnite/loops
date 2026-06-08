import { describe, expect, it } from "vitest";
import {
  isAssistantHeaderLine,
  isLogHeaderLine,
  renderMarkdownForTerminal,
} from "../../src/core/log-display.js";

describe("log display", () => {
  it("detects log header and assistant header lines", () => {
    const header = "2026-06-08T15:14:48.516Z [assistant]";
    expect(isLogHeaderLine(header)).toBe(true);
    expect(isAssistantHeaderLine(header)).toBe(true);
    expect(isAssistantHeaderLine("plain text")).toBe(false);
  });

  it("renders markdown without color when NO_COLOR is set", () => {
    const previous = process.env.NO_COLOR;
    process.env.NO_COLOR = "1";

    try {
      expect(renderMarkdownForTerminal("# Title\n\n**bold** and `code`")).toBe(
        "# Title\n\n**bold** and `code`",
      );
    } finally {
      if (previous === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = previous;
      }
    }
  });
});
