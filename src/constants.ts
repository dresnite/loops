export const LOOPS_DIR_NAME = ".loops";

export const SUPPORTED_PROVIDERS = ["cursor"] as const;
export type ProviderId = (typeof SUPPORTED_PROVIDERS)[number];

export const PLANNED_PROVIDERS = ["claude-code"] as const;
export type PlannedProviderId = (typeof PLANNED_PROVIDERS)[number];

export const DEFAULT_PROVIDER: ProviderId = "cursor";
export const DEFAULT_MODEL = "composer-2.5";

/** Default rates for composer-2.5 (standard). See model-pricing.ts for per-model rates. */
export const TOKEN_COST_PER_MILLION = {
  input: 0.5,
  output: 2.5,
  cacheRead: 0.125,
  cacheWrite: 0.625,
} as const;
