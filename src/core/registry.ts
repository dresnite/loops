import { join } from "pathe";
import { DEFAULT_PROVIDER } from "../constants.js";
import type { CreateLoopInput, LoopDefinition } from "../types.js";
import {
  ensureStorageDirs,
  getStoragePaths,
  listJsonFiles,
  readJson,
  removeFile,
  writeJsonAtomic,
  type StoragePaths,
} from "./storage.js";

function definitionPath(paths: StoragePaths, name: string): string {
  return join(paths.definitions, `${name}.json`);
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function addLoop(
  input: CreateLoopInput,
  paths = getStoragePaths(),
): Promise<LoopDefinition> {
  await ensureStorageDirs(paths);

  const filePath = definitionPath(paths, input.name);
  const existing = await readJson<LoopDefinition>(filePath);
  if (existing) {
    throw new Error(`Loop definition "${input.name}" already exists`);
  }

  const timestamp = nowIso();
  const definition: LoopDefinition = {
    name: input.name,
    description: input.description,
    defaultPrompt: input.defaultPrompt,
    defaultPreset: input.defaultPreset,
    provider: input.provider ?? DEFAULT_PROVIDER,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await writeJsonAtomic(filePath, definition);
  return definition;
}

export async function getLoop(
  name: string,
  paths = getStoragePaths(),
): Promise<LoopDefinition | null> {
  return readJson<LoopDefinition>(definitionPath(paths, name));
}

export async function listLoops(
  paths = getStoragePaths(),
): Promise<LoopDefinition[]> {
  const files = await listJsonFiles(paths.definitions);
  const definitions = await Promise.all(
    files.map((file) => readJson<LoopDefinition>(join(paths.definitions, file))),
  );
  return definitions
    .filter((definition): definition is LoopDefinition => definition !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function removeLoop(
  name: string,
  paths = getStoragePaths(),
): Promise<void> {
  const existing = await getLoop(name, paths);
  if (!existing) {
    throw new Error(`Loop definition "${name}" not found`);
  }

  await removeFile(definitionPath(paths, name));
}
