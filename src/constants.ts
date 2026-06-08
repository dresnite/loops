export const LOOPS_DIR_NAME = ".loops";

export const SUPPORTED_PROVIDERS = ["cursor"] as const;
export type ProviderId = (typeof SUPPORTED_PROVIDERS)[number];

export const PLANNED_PROVIDERS = ["claude-code"] as const;
export type PlannedProviderId = (typeof PLANNED_PROVIDERS)[number];

export const DEFAULT_PROVIDER: ProviderId = "cursor";
export const DEFAULT_MODEL = "composer-2.5";

export const TOKEN_COST_PER_MILLION = {
  input: 3,
  output: 15,
  cacheRead: 0.75,
  cacheWrite: 3.75,
} as const;
