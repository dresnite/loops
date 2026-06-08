import { describe, expect, it } from "vitest";
import { assertSupportedProvider } from "../../src/providers/index.js";

describe("providers", () => {
  it("accepts supported providers", () => {
    expect(assertSupportedProvider("cursor")).toBe("cursor");
  });

  it("rejects planned providers", () => {
    expect(() => assertSupportedProvider("claude-code")).toThrow(
      "planned but not yet supported",
    );
  });

  it("rejects unknown providers", () => {
    expect(() => assertSupportedProvider("unknown")).toThrow(
      'Unknown provider "unknown"',
    );
  });
});
