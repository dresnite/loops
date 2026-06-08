import { describe, expect, it, vi } from "vitest";
import {
  createLogLinePrinter,
  renderMarkdownForTerminal,
} from "../../src/core/log-display.js";
import { formatLogHeader } from "../../src/core/logs.js";

describe("log display", () => {
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

  it("renders assistant block body lines with markdown formatting", () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    try {
      const printer = createLogLinePrinter();
      const header = formatLogHeader("[assistant]");

      printer.print(header);
      printer.print("# Title");
      printer.print("");
      printer.print("- item");
      printer.print(`${formatLogHeader("[task 1] finished")}`);

      expect(logs[0]).toBe(header);
      expect(logs[1]).toBe("# Title");
      expect(logs[2]).toBe("");
      expect(logs[3]).toBe("- item");
      expect(logs[4]).toContain("[task 1] finished");
    } finally {
      console.log = originalLog;
    }
  });
});
