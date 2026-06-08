import {
  DEFAULT_PROVIDER,
  PLANNED_PROVIDERS,
  SUPPORTED_PROVIDERS,
  type ProviderId,
} from "../constants.js";
import { CursorProvider } from "./cursor.js";
import { MockProvider } from "./mock.js";
import type { AgentProvider } from "./types.js";

export { CursorProvider } from "./cursor.js";
export { MockProvider, resetMockProviderIds } from "./mock.js";
export type {
  AgentProvider,
  AgentRun,
  AgentSession,
  RunResult,
  SessionOptions,
  StreamEvent,
} from "./types.js";

export { PLANNED_PROVIDERS, SUPPORTED_PROVIDERS };

let providerOverride: AgentProvider | null = null;

export function setProviderForTesting(provider: AgentProvider | null): void {
  providerOverride = provider;
}

export function getProvider(id: ProviderId = DEFAULT_PROVIDER): AgentProvider {
  if (providerOverride) {
    return providerOverride;
  }

  if (process.env.LOOPS_TEST_MODE === "1") {
    return new MockProvider({ runs: [{}, {}, {}] });
  }

  switch (id) {
    case "cursor":
      return new CursorProvider();
    default: {
      const exhaustive: never = id;
      throw new Error(`Unsupported provider: ${exhaustive}`);
    }
  }
}

export function assertSupportedProvider(id: string): ProviderId {
  if ((SUPPORTED_PROVIDERS as readonly string[]).includes(id)) {
    return id as ProviderId;
  }

  if ((PLANNED_PROVIDERS as readonly string[]).includes(id)) {
    throw new Error(
      `Provider "${id}" is planned but not yet supported. Supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
    );
  }

  throw new Error(
    `Unknown provider "${id}". Supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
  );
}
