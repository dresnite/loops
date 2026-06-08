import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getWorkerScriptPath,
  isDistModule,
  isWorkerCliInvocation,
  resolveArgvPath,
} from "../../src/core/paths.js";

describe("resolveArgvPath", () => {
  it("resolves file URLs and filesystem paths", () => {
    const filePath = fileURLToPath(import.meta.url);
    expect(resolveArgvPath(filePath)).toBe(filePath);
    expect(resolveArgvPath(pathToFileURL(filePath).href)).toBe(filePath);
  });
});

describe("isDistModule", () => {
  it("detects bundled dist modules", () => {
    expect(isDistModule("file:///project/dist/runner-abc.mjs")).toBe(true);
    expect(isDistModule("file:///project/src/core/paths.ts")).toBe(false);
  });
});

describe("getWorkerScriptPath", () => {
  it("resolves worker.ts in source builds", () => {
    const moduleUrl = new URL("../../src/core/runner.ts", import.meta.url);
    expect(getWorkerScriptPath(moduleUrl)).toMatch(/worker\.ts$/);
  });

  it("resolves worker.mjs in bundled dist builds", () => {
    const moduleUrl = new URL("../../dist/runner-test.mjs", import.meta.url);
    expect(getWorkerScriptPath(moduleUrl)).toMatch(/worker\.mjs$/);
  });
});

describe("isWorkerCliInvocation", () => {
  it("matches direct worker module invocations", () => {
    const moduleUrl = new URL("../../src/core/worker.ts", import.meta.url);
    const argv = ["node", fileURLToPath(moduleUrl)];

    expect(isWorkerCliInvocation(argv, moduleUrl)).toBe(true);
  });

  it("matches bundled worker.mjs wrapper invocations", () => {
    const moduleUrl = new URL("../../src/core/worker.ts", import.meta.url);
    const argv = ["node", "/project/dist/worker.mjs"];

    expect(isWorkerCliInvocation(argv, moduleUrl)).toBe(true);
  });
});
