import { appendFile, readFile, stat } from "node:fs/promises";
import { join } from "pathe";
import { ensureStorageDirs, getStoragePaths, type StoragePaths } from "./storage.js";

const FOLLOW_POLL_MS = 500;

function logPath(paths: StoragePaths, runId: string): string {
  return join(paths.logs, `${runId}.log`);
}

export function truncateLogText(text: string, max = 200): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max)}...`;
}

export async function appendRunLog(
  runId: string,
  message: string,
  paths = getStoragePaths(),
): Promise<void> {
  await ensureStorageDirs(paths);
  const line = `${new Date().toISOString()} ${message}\n`;
  await appendFile(logPath(paths, runId), line, "utf8");
}

export async function readRunLog(
  runId: string,
  options: { tail?: number } = {},
  paths = getStoragePaths(),
): Promise<string[]> {
  const tail = options.tail ?? 50;

  try {
    const raw = await readFile(logPath(paths, runId), "utf8");
    const lines = raw.split("\n").filter((line) => line.length > 0);
    return lines.slice(-tail);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
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
  const filePath = logPath(paths, runId);
  let offset = 0;

  try {
    const { size } = await stat(filePath);
    offset = size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const interval = setInterval(() => {
    void (async () => {
      try {
        const content = await readFile(filePath);
        if (content.length <= offset) {
          return;
        }

        const newText = content.subarray(offset).toString("utf8");
        offset = content.length;

        for (const line of newText.split("\n").filter((entry) => entry.length > 0)) {
          onLine(line);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    })();
  }, FOLLOW_POLL_MS);

  return () => {
    clearInterval(interval);
  };
}
