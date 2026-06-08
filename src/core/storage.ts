import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "pathe";
import { LOOPS_DIR_NAME } from "../constants.js";

const writeQueues = new Map<string, Promise<void>>();

export interface StoragePaths {
  root: string;
  definitions: string;
  runs: string;
  logs: string;
}

export function getStoragePaths(homeDir = homedir()): StoragePaths {
  const root = join(homeDir, LOOPS_DIR_NAME);
  return {
    root,
    definitions: join(root, "definitions"),
    runs: join(root, "runs"),
    logs: join(root, "logs"),
  };
}

export async function ensureStorageDirs(paths = getStoragePaths()): Promise<void> {
  await mkdir(paths.definitions, { recursive: true });
  await mkdir(paths.runs, { recursive: true });
  await mkdir(paths.logs, { recursive: true });
}

async function writeJsonAtomicOnce<T>(filePath: string, data: T): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export async function writeJsonAtomic<T>(
  filePath: string,
  data: T,
): Promise<void> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => writeJsonAtomicOnce(filePath, data));

  writeQueues.set(filePath, next);

  try {
    await next;
  } finally {
    if (writeQueues.get(filePath) === next) {
      writeQueues.delete(filePath);
    }
  }
}

export function resetWriteQueuesForTesting(): void {
  writeQueues.clear();
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function listJsonFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath);
    return entries.filter((entry) => entry.endsWith(".json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function removeFile(filePath: string): Promise<void> {
  try {
    await rm(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
