import { appendFile, readFile, stat } from "node:fs/promises";
import { join } from "pathe";
import { getErrorMessage, isErrnoCode } from "./errors.js";
import { ensureStorageDirs, getStoragePaths, type StoragePaths } from "./storage.js";

export const ASSISTANT_LOG_LABEL = "[assistant]" as const;

export const LOG_HEADER_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z /;

export const FOLLOW_POLL_MS = 500;

export function formatLogHeader(label: string, date = new Date()): string {
  return `${date.toISOString()} ${label}`;
}

export function isLogHeaderLine(line: string): boolean {
  return LOG_HEADER_PATTERN.test(line);
}

export function logHeaderLabel(line: string): string | null {
  if (!isLogHeaderLine(line)) {
    return null;
  }

  return line.replace(LOG_HEADER_PATTERN, "");
}

export function isAssistantHeaderLine(line: string): boolean {
  return logHeaderLabel(line)?.trimEnd() === ASSISTANT_LOG_LABEL;
}

export interface IncomingLogTextSplit {
  partialLine: string;
  completeLines: string[];
}

export function splitIncomingLogText(
  previousPartial: string,
  newText: string,
): IncomingLogTextSplit {
  const combined = previousPartial + newText;
  const chunks = combined.split("\n");

  if (combined.endsWith("\n")) {
    return {
      partialLine: "",
      completeLines: chunks.slice(0, -1),
    };
  }

  return {
    partialLine: chunks.pop() ?? "",
    completeLines: chunks,
  };
}

export function runLogPath(paths: StoragePaths, runId: string): string {
  return join(paths.logs, `${runId}.log`);
}

export function truncateLogText(text: string, max = 200): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max)}...`;
}

export function formatAssistantLogText(text: string, max = 4000): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  if (normalized.length <= max) {
    return normalized;
  }

  const truncated = normalized.slice(0, max);
  const lastNewline = truncated.lastIndexOf("\n");

  if (lastNewline > max * 0.8) {
    return `${truncated.slice(0, lastNewline)}\n...`;
  }

  return `${truncated}...`;
}

export async function appendRunLog(
  runId: string,
  message: string,
  paths = getStoragePaths(),
): Promise<void> {
  await ensureStorageDirs(paths);
  const line = `${formatLogHeader(message)}\n`;
  await appendFile(runLogPath(paths, runId), line, "utf8");
}

export async function appendRunLogBlock(
  runId: string,
  label: string,
  body: string,
  paths = getStoragePaths(),
): Promise<void> {
  await ensureStorageDirs(paths);
  const header = `${formatLogHeader(label)}\n`;
  const content = body.length > 0 ? `${body}\n` : "";
  await appendFile(runLogPath(paths, runId), `${header}${content}`, "utf8");
}

export async function readRunLog(
  runId: string,
  options: { tail?: number } = {},
  paths = getStoragePaths(),
): Promise<string[]> {
  const tail = options.tail ?? 50;

  try {
    const raw = await readFile(runLogPath(paths, runId), "utf8");
    const lines = raw.split("\n");
    while (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }
    return lines.slice(-tail);
  } catch (error) {
    if (isErrnoCode(error, "ENOENT")) {
      return [];
    }
    throw error;
  }
}

export async function followRunLog(
  runId: string,
  onLine: (line: string) => void,
  paths = getStoragePaths(),
): Promise<() => void> {
  const filePath = runLogPath(paths, runId);
  let offset = 0;
  let reading = false;
  let partialLine = "";

  try {
    const { size } = await stat(filePath);
    offset = size;
  } catch (error) {
    if (!isErrnoCode(error, "ENOENT")) {
      throw error;
    }
  }

  const interval = setInterval(() => {
    if (reading) {
      return;
    }

    reading = true;
    void (async () => {
      try {
        const content = await readFile(filePath);
        if (content.length <= offset) {
          return;
        }

        const newText = content.subarray(offset).toString("utf8");
        offset = content.length;

        const parsed = splitIncomingLogText(partialLine, newText);
        partialLine = parsed.partialLine;
        for (const line of parsed.completeLines) {
          onLine(line);
        }
      } catch (error) {
        if (!isErrnoCode(error, "ENOENT")) {
          console.error(
            `failed to follow log for run "${runId}": ${getErrorMessage(error)}`,
          );
        }
      } finally {
        reading = false;
      }
    })();
  }, FOLLOW_POLL_MS);

  return () => {
    clearInterval(interval);
  };
}
