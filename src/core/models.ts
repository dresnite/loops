import {
  Cursor,
  type ModelListItem,
  type ModelParameterValue,
  type ModelSelection,
} from "@cursor/sdk";
import { DEFAULT_MODEL } from "../constants.js";
import { getCursorApiKey } from "./credentials.js";
import type { LoopDefinition, StartRunInput } from "../types.js";

const MAX_LISTED_MODELS = 12;
export const COMPOSER_25_FAST_ALIAS = "composer-2.5-fast";
const COMPOSER_FAST_PARAMETER = "fast";

const COMPOSER_25_STANDARD_PARAMS: ModelParameterValue[] = [
  { id: COMPOSER_FAST_PARAMETER, value: "false" },
];
const COMPOSER_25_FAST_PARAMS: ModelParameterValue[] = [
  { id: COMPOSER_FAST_PARAMETER, value: "true" },
];

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

function hasComposerFastParameter(model: ModelListItem): boolean {
  return model.parameters?.some((parameter) => parameter.id === COMPOSER_FAST_PARAMETER) ?? false;
}

function findComposer25Model(models: ModelListItem[]): ModelListItem | undefined {
  return findModelByIdOrAlias(DEFAULT_MODEL, models);
}

export function buildModelSelection(
  modelId: string,
  models: ModelListItem[],
): ModelSelection {
  if (modelId === COMPOSER_25_FAST_ALIAS) {
    const composer = findComposer25Model(models);
    if (!composer) {
      throw new Error(
        `Unknown model "${modelId}". Composer 2.5 is not available on this account.`,
      );
    }

    if (hasComposerFastParameter(composer)) {
      return { id: composer.id, params: COMPOSER_25_FAST_PARAMS };
    }

    return { id: COMPOSER_25_FAST_ALIAS };
  }

  const canonicalId = resolveModel(modelId, models);
  const match = models.find((model) => model.id === canonicalId);
  if (!match) {
    throw new Error(`Unknown model "${modelId}".`);
  }

  if (canonicalId === DEFAULT_MODEL && hasComposerFastParameter(match)) {
    return { id: canonicalId, params: COMPOSER_25_STANDARD_PARAMS };
  }

  return { id: canonicalId };
}

export async function resolveModelSelectionForRun(
  modelId: string,
  apiKey?: string,
): Promise<ModelSelection> {
  if (process.env.LOOPS_TEST_MODE === "1" && !modelListForTesting) {
    return buildModelSelection(modelId, [
      {
        id: DEFAULT_MODEL,
        displayName: "Composer 2.5",
        parameters: [
          {
            id: COMPOSER_FAST_PARAMETER,
            values: [{ value: "false" }, { value: "true" }],
          },
        ],
      },
      {
        id: COMPOSER_25_FAST_ALIAS,
        displayName: "Composer 2.5 Fast",
      },
    ]);
  }

  const models = await listAvailableModels(apiKey);
  return buildModelSelection(modelId, models);
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

  if (modelId === COMPOSER_25_FAST_ALIAS) {
    const models = await listAvailableModels(apiKey);
    if (findComposer25Model(models)) {
      return COMPOSER_25_FAST_ALIAS;
    }
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
