import { DEFAULT_MODEL } from "../constants.js";

export interface TokenRates {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

function scaleCacheRates(inputRate: number): Pick<TokenRates, "cacheRead" | "cacheWrite"> {
  return {
    cacheRead: inputRate * 0.25,
    cacheWrite: inputRate * 1.25,
  };
}

function rates(input: number, output: number): TokenRates {
  return { input, output, ...scaleCacheRates(input) };
}

/** Approximate USD per million tokens. Actual billing follows your Cursor plan. */
export const MODEL_TOKEN_RATES: Record<string, TokenRates> = {
  "composer-2.5": rates(0.5, 2.5),
  "composer-2.5-fast": rates(3, 15),
  "composer-2": rates(0.5, 2.5),
  "composer-2-fast": rates(1.5, 7.5),
  "gpt-5.2": rates(5, 30),
  "gpt-5.3-codex": rates(5, 30),
  "claude-4-sonnet": rates(3, 15),
  "claude-4.6-sonnet-medium-thinking": rates(3, 15),
  "claude-opus-4-8-thinking-high": rates(5, 25),
};

const DEFAULT_RATES: TokenRates = MODEL_TOKEN_RATES[DEFAULT_MODEL]!;

export function getModelTokenRates(modelId?: string): TokenRates {
  if (modelId !== undefined && modelId in MODEL_TOKEN_RATES) {
    return MODEL_TOKEN_RATES[modelId]!;
  }

  return DEFAULT_RATES;
}
