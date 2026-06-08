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
  const match = line.match(LOG_HEADER_PATTERN);
  return match ? line.slice(match[0].length) : null;
}

export function isAssistantHeaderLine(line: string): boolean {
  return logHeaderLabel(line)?.trimEnd() === ASSISTANT_LOG_LABEL;
}

export interface IncomingLogTextSplit {
  partialLine: string;
  completeLines: string[];
}

export interface LogFileFollowState {
  offset: number;
  partialLine: string;
}

export interface LogFileFollowDelta {
  offset: number;
  partialLine: string;
  completeLines: string[];
}

export function readLogFileDelta(
  content: Buffer,
  state: LogFileFollowState,
): LogFileFollowDelta {
  let { offset, partialLine } = state;

  if (content.length < offset) {
    offset = 0;
    partialLine = "";
  }

  if (content.length <= offset) {
    return { offset, partialLine, completeLines: [] };
  }

  const newText = content.subarray(offset).toString("utf8");
  const parsed = splitIncomingLogText(partialLine, newText);

  return {
    offset: content.length,
    partialLine: parsed.partialLine,
    completeLines: parsed.completeLines,
  };
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

function stripTrailingEmptyLines(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === "") {
    end--;
  }
  return lines.slice(0, end);
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

async function writeRunLog(
  runId: string,
  text: string,
  paths: StoragePaths,
): Promise<void> {
  await ensureStorageDirs(paths);
  await appendFile(runLogPath(paths, runId), text, "utf8");
}

export async function appendRunLog(
  runId: string,
  message: string,
  paths = getStoragePaths(),
): Promise<void> {
  await appendRunLogBlock(runId, message, "", paths);
}

export async function appendRunLogBlock(
  runId: string,
  label: string,
  body: string,
  paths = getStoragePaths(),
): Promise<void> {
  const header = `${formatLogHeader(label)}\n`;
  const content = body.length > 0 ? `${body}\n` : "";
  await writeRunLog(runId, `${header}${content}`, paths);
}

export async function readRunLog(
  runId: string,
  options: { tail?: number } = {},
  paths = getStoragePaths(),
): Promise<string[]> {
  const tail = options.tail ?? 50;

  try {
    const raw = await readFile(runLogPath(paths, runId), "utf8");
    return stripTrailingEmptyLines(raw.split("\n")).slice(-tail);
  } catch (error) {
    if (isErrnoCode(error, "ENOENT")) {
      return [];
    }
    throw error;
  }
}

export type LogFollowStop = () => void;

export async function followRunLog(
  runId: string,
  onLine: (line: string) => void,
  paths = getStoragePaths(),
): Promise<LogFollowStop> {
  const filePath = runLogPath(paths, runId);
  let followState: LogFileFollowState = { offset: 0, partialLine: "" };
  let reading = false;
  let stopped = false;

  try {
    const { size } = await stat(filePath);
    followState.offset = size;
  } catch (error) {
    if (!isErrnoCode(error, "ENOENT")) {
      throw error;
    }
  }

  async function pollAppend(): Promise<void> {
    if (stopped) {
      return;
    }

    const content = await readFile(filePath);
    if (stopped) {
      return;
    }

    const delta = readLogFileDelta(content, followState);
    followState = {
      offset: delta.offset,
      partialLine: delta.partialLine,
    };

    for (const line of delta.completeLines) {
      onLine(line);
    }
  }

  const interval = setInterval(() => {
    if (stopped || reading) {
      return;
    }

    reading = true;
    void pollAppend()
      .catch((error) => {
        if (!isErrnoCode(error, "ENOENT")) {
          console.error(
            `failed to follow log for run "${runId}": ${getErrorMessage(error)}`,
          );
        }
      })
      .finally(() => {
        reading = false;
      });
  }, FOLLOW_POLL_MS);

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
