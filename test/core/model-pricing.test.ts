import { describe, expect, it } from "vitest";
import { getModelTokenRates } from "../../src/core/model-pricing.js";

describe("model-pricing", () => {
  it("uses standard composer-2.5 rates by default", () => {
    expect(getModelTokenRates("composer-2.5")).toEqual({
      input: 0.5,
      output: 2.5,
      cacheRead: 0.125,
      cacheWrite: 0.625,
    });
  });

  it("uses fast-tier rates for composer-2.5-fast", () => {
    expect(getModelTokenRates("composer-2.5-fast")).toEqual({
      input: 3,
      output: 15,
      cacheRead: 0.75,
      cacheWrite: 3.75,
    });
  });

  it("falls back to default model rates for unknown models", () => {
    expect(getModelTokenRates("unknown-model")).toEqual(
      getModelTokenRates("composer-2.5"),
    );
  });
});
