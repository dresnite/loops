import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { join } from "pathe";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const distCliPath = join(projectRoot, "dist", "cli.mjs");

export default async function globalSetup(): Promise<void> {
  try {
    await access(distCliPath);
  } catch {
    await execa("npm", ["run", "build"], { cwd: projectRoot });
  }
}
