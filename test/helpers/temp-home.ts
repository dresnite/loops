import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";

export async function createTempHome(): Promise<{
  homeDir: string;
  cleanup: () => Promise<void>;
}> {
  const homeDir = await mkdtemp(join(tmpdir(), "loops-test-"));
  return {
    homeDir,
    cleanup: async () => {
      await rm(homeDir, { recursive: true, force: true });
    },
  };
}
