import { describe, expect, it } from "vitest";
import {
  isActiveRun,
  isLsDefaultVisible,
  isRunStopped,
} from "../../src/core/run-state.js";
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

describe("isRunStopped", () => {
  it("matches only stopped runs", () => {
    expect(isRunStopped(makeTestRun({ status: "stopped" }))).toBe(true);
    expect(isRunStopped(makeTestRun({ status: "running" }))).toBe(false);
    expect(isRunStopped(makeTestRun({ status: "finished" }))).toBe(false);
  });
});

describe("isLsDefaultVisible", () => {
  it("shows active and error runs", () => {
    expect(isLsDefaultVisible(makeTestRun({ status: "running" }))).toBe(true);
    expect(isLsDefaultVisible(makeTestRun({ status: "starting" }))).toBe(true);
    expect(isLsDefaultVisible(makeTestRun({ status: "error" }))).toBe(true);
  });

  it("hides finished and stopped runs", () => {
    expect(isLsDefaultVisible(makeTestRun({ status: "finished" }))).toBe(false);
    expect(isLsDefaultVisible(makeTestRun({ status: "stopped" }))).toBe(false);
  });
});
