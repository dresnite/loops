import { readFile } from "node:fs/promises";
import { resolve } from "pathe";
import type { LoopDefinition, ResolvedPrompt } from "../types.js";

export interface PromptResolutionInput {
  prompt?: string;
  presetPath?: string;
  definition?: LoopDefinition;
  cwd?: string;
}

export async function resolvePrompt(
  input: PromptResolutionInput,
): Promise<ResolvedPrompt> {
  if (input.prompt) {
    return { text: input.prompt };
  }

  const presetCandidate = input.presetPath ?? input.definition?.defaultPreset;
  if (presetCandidate) {
    const presetPath = resolve(input.cwd ?? process.cwd(), presetCandidate);
    const text = await readFile(presetPath, "utf8");
    return { text: text.trim(), presetPath };
  }

  if (input.definition?.defaultPrompt) {
    return { text: input.definition.defaultPrompt };
  }

  throw new Error(
    "No prompt provided. Use --prompt, --preset, or set a default on the loop definition.",
  );
}
