import { afterEach, describe, expect, it } from "vitest";
import {
  assertValidModel,
  findModelByIdOrAlias,
  resolveModel,
  resolveRunModel,
  setModelListForTesting,
} from "../../src/core/models.js";
import { DEFAULT_MODEL } from "../../src/constants.js";
import type { LoopDefinition } from "../../src/types.js";

const TEST_MODELS = [
  { id: "composer-2.5", displayName: "Composer 2.5", aliases: [] },
  { id: "composer-2.5-fast", displayName: "Composer 2.5 Fast", aliases: [] },
  { id: "gpt-5.2", displayName: "GPT-5.2", aliases: ["gpt5.2"] },
];

afterEach(() => {
  setModelListForTesting(null);
});

describe("models", () => {
  it("finds models by id or alias", () => {
    expect(findModelByIdOrAlias("composer-2.5", TEST_MODELS)?.id).toBe(
      "composer-2.5",
    );
    expect(findModelByIdOrAlias("gpt5.2", TEST_MODELS)?.id).toBe("gpt-5.2");
    expect(findModelByIdOrAlias("missing", TEST_MODELS)).toBeUndefined();
  });

  it("resolves canonical model ids", () => {
    expect(resolveModel("gpt5.2", TEST_MODELS)).toBe("gpt-5.2");
  });

  it("throws for unknown models", () => {
    expect(() => resolveModel("not-a-model", TEST_MODELS)).toThrow(
      'Unknown model "not-a-model"',
    );
  });

  it("validates models against the test hook list", async () => {
    setModelListForTesting(TEST_MODELS);

    await expect(assertValidModel("composer-2.5-fast")).resolves.toBe(
      "composer-2.5-fast",
    );
    await expect(assertValidModel("not-a-model")).rejects.toThrow(
      'Unknown model "not-a-model"',
    );
  });

  it("resolves run model from input, definition, then default", () => {
    const definition = {
      name: "refactor",
      provider: "cursor",
      defaultModel: "gpt-5.2",
      createdAt: "",
      updatedAt: "",
    } satisfies LoopDefinition;

    expect(resolveRunModel({}, definition)).toBe("gpt-5.2");
    expect(resolveRunModel({ model: "composer-2.5-fast" }, definition)).toBe(
      "composer-2.5-fast",
    );
    expect(
      resolveRunModel(
        {},
        { ...definition, defaultModel: undefined },
      ),
    ).toBe(DEFAULT_MODEL);
  });
});
