import { chmod } from "node:fs/promises";
import { join } from "pathe";
import type { ProviderId } from "../constants.js";
import {
  ensureStorageDirs,
  getStoragePaths,
  readJson,
  writeJsonAtomic,
  type StoragePaths,
} from "./storage.js";

export interface CredentialsFile {
  cursor?: string;
  updatedAt: string;
}

function credentialsPath(paths: StoragePaths): string {
  return join(paths.root, "credentials.json");
}

export async function getCredentials(
  paths = getStoragePaths(),
): Promise<CredentialsFile | null> {
  return readJson<CredentialsFile>(credentialsPath(paths));
}

export async function setProviderKey(
  provider: ProviderId,
  apiKey: string,
  paths = getStoragePaths(),
): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("API key cannot be empty");
  }

  await ensureStorageDirs(paths);

  const existing = (await getCredentials(paths)) ?? {
    updatedAt: new Date().toISOString(),
  };

  const credentials: CredentialsFile = {
    ...existing,
    [provider]: trimmed,
    updatedAt: new Date().toISOString(),
  };

  const filePath = credentialsPath(paths);
  await writeJsonAtomic(filePath, credentials);
  await chmod(filePath, 0o600);
}

export function getCursorApiKeyFromEnv(): string | undefined {
  const value = process.env.CURSOR_API_KEY?.trim();
  return value || undefined;
}

export async function getCursorApiKey(
  paths = getStoragePaths(),
): Promise<string | undefined> {
  const fromEnv = getCursorApiKeyFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  const credentials = await getCredentials(paths);
  return credentials?.cursor?.trim() || undefined;
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "****";
  }

  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
}

export async function listConfiguredProviders(
  paths = getStoragePaths(),
): Promise<Array<{ provider: ProviderId; masked: string }>> {
  const credentials = await getCredentials(paths);
  if (!credentials?.cursor) {
    return [];
  }

  return [{ provider: "cursor", masked: maskApiKey(credentials.cursor) }];
}

export function cursorApiKeyMissingMessage(): string {
  return [
    "Cursor API key not configured.",
    "Run: loops key set cursor <your-key>",
    "Get a key at: https://cursor.com/dashboard/integrations",
  ].join("\n");
}

export async function requireCursorApiKey(
  paths = getStoragePaths(),
): Promise<string> {
  if (process.env.LOOPS_TEST_MODE === "1") {
    return "test-key";
  }

  const apiKey = await getCursorApiKey(paths);
  if (!apiKey) {
    throw new Error(cursorApiKeyMissingMessage());
  }

  return apiKey;
}
