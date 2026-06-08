import { Cursor, type ModelListItem } from "@cursor/sdk";
import { DEFAULT_MODEL } from "../constants.js";
import { getCursorApiKey } from "./credentials.js";
import type { LoopDefinition, StartRunInput } from "../types.js";

const MAX_LISTED_MODELS = 12;

let modelListForTesting: ModelListItem[] | null = null;

export function setModelListForTesting(models: ModelListItem[] | null): void {
  modelListForTesting = models;
}

export function findModelByIdOrAlias(
  id: string,
  models: ModelListItem[],
): ModelListItem | undefined {
  const exact = models.find((model) => model.id === id);
  if (exact) {
    return exact;
  }

  return models.find((model) => model.aliases?.includes(id) === true);
}

export function resolveModel(id: string, models: ModelListItem[]): string {
  const match = findModelByIdOrAlias(id, models);
  if (!match) {
    const available = models.map((model) => model.id);
    const preview =
      available.length <= MAX_LISTED_MODELS
        ? available.join(", ")
        : `${available.slice(0, MAX_LISTED_MODELS).join(", ")}, ...`;
    throw new Error(
      `Unknown model "${id}". Available models: ${preview}. Use Cursor.models.list() to discover valid selections.`,
    );
  }

  return match.id;
}

export async function listAvailableModels(
  apiKey?: string,
): Promise<ModelListItem[]> {
  if (modelListForTesting) {
    return modelListForTesting;
  }

  const key = apiKey ?? (await getCursorApiKey());
  if (!key) {
    throw new Error("Cursor API key not configured.");
  }

  return Cursor.models.list({ apiKey: key });
}

export async function assertValidModel(
  modelId: string,
  apiKey?: string,
): Promise<string> {
  if (process.env.LOOPS_TEST_MODE === "1" && !modelListForTesting) {
    return modelId;
  }

  const models = await listAvailableModels(apiKey);
  return resolveModel(modelId, models);
}

export function resolveRunModel(
  input: Pick<StartRunInput, "model">,
  definition: LoopDefinition,
): string {
  return input.model ?? definition.defaultModel ?? DEFAULT_MODEL;
}
