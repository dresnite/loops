import type { ModelListItem } from "@cursor/sdk";

export const COMPOSER_25_WITH_FAST_PARAM: ModelListItem = {
  id: "composer-2.5",
  displayName: "Composer 2.5",
  aliases: ["composer-latest", "composer"],
  parameters: [
    {
      id: "fast",
      displayName: "Fast",
      values: [{ value: "false" }, { value: "true", displayName: "Fast" }],
    },
  ],
  variants: [
    {
      params: [{ id: "fast", value: "true" }],
      displayName: "Composer 2.5",
      isDefault: true,
    },
    {
      params: [{ id: "fast", value: "false" }],
      displayName: "Composer 2.5",
    },
  ],
};
