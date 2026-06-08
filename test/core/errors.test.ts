import { describe, expect, it } from "vitest";
import { getErrorMessage, isErrnoCode } from "../../src/core/errors.js";

describe("getErrorMessage", () => {
  it("returns message from Error instances", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-error values", () => {
    expect(getErrorMessage("plain")).toBe("plain");
  });
});

describe("isErrnoCode", () => {
  it("matches node errno codes", () => {
    const error: unknown = { code: "ENOENT" };

    expect(isErrnoCode(error, "ENOENT")).toBe(true);
    if (isErrnoCode(error, "ENOENT")) {
      expect(error.code).toBe("ENOENT");
    }

    expect(isErrnoCode({ code: "ENOENT" }, "ESRCH")).toBe(false);
    expect(isErrnoCode(null, "ENOENT")).toBe(false);
  });
});
