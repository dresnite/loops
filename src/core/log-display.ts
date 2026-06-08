import { isAssistantHeaderLine, isLogHeaderLine } from "./logs.js";

const ANSI = {
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
};

function colorEnabled(): boolean {
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }

  return Boolean(process.stdout.isTTY);
}

export function renderMarkdownForTerminal(text: string): string {
  if (!colorEnabled()) {
    return text;
  }

  return text
    .split("\n")
    .map((line) => {
      if (line.startsWith("### ")) {
        return `${ANSI.bold}${line.slice(4)}${ANSI.reset}`;
      }

      if (line.startsWith("## ")) {
        return `${ANSI.bold}${line.slice(3)}${ANSI.reset}`;
      }

      if (line.startsWith("# ")) {
        return `${ANSI.bold}${line.slice(2)}${ANSI.reset}`;
      }

      if (line.startsWith("- ") || line.startsWith("* ")) {
        return `  ${renderInlineMarkdown(line)}`;
      }

      return renderInlineMarkdown(line);
    })
    .join("\n");
}

function renderInlineMarkdown(line: string): string {
  return line
    .replace(/\*\*(.+?)\*\*/g, `${ANSI.bold}$1${ANSI.reset}`)
    .replace(/`([^`]+)`/g, `${ANSI.cyan}$1${ANSI.reset}`);
}

export type LogLineOutput = (line: string) => void;

export interface LogLinePrinter {
  print(line: string): void;
}

function formatLogLine(line: string, inAssistantBlock: boolean): string {
  if (inAssistantBlock && !isLogHeaderLine(line)) {
    return renderMarkdownForTerminal(line);
  }

  return line;
}

export function createLogLinePrinter(
  output: LogLineOutput = (line) => console.log(line),
): LogLinePrinter {
  let inAssistantBlock = false;

  return {
    print(line: string) {
      if (isAssistantHeaderLine(line)) {
        inAssistantBlock = true;
        output(line);
        return;
      }

      if (isLogHeaderLine(line)) {
        inAssistantBlock = false;
      }

      output(formatLogLine(line, inAssistantBlock));
    },
  };
}

export function printLogLines(lines: string[]): void {
  const printer = createLogLinePrinter();

  for (const line of lines) {
    printer.print(line);
  }
}
