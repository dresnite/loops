import { describe, expect, it } from "vitest";
import { isActiveRun } from "../../src/core/run-state.js";
import { makeTestRun } from "../helpers/make-run.js";

describe("isActiveRun", () => {
  it("treats starting and running as active", () => {
    expect(isActiveRun(makeTestRun({ status: "starting" }))).toBe(true);
    expect(isActiveRun(makeTestRun({ status: "running" }))).toBe(true);
  });

  it("treats terminal states as inactive", () => {
    expect(isActiveRun(makeTestRun({ status: "stopped" }))).toBe(false);
    expect(isActiveRun(makeTestRun({ status: "finished" }))).toBe(false);
    expect(isActiveRun(makeTestRun({ status: "error" }))).toBe(false);
  });
});
