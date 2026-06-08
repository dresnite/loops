import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
    worker: "src/core/worker.ts",
  },
  format: ["esm"],
  target: "node20",
  dts: true,
  clean: true,
  shims: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
