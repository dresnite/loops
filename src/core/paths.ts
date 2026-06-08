import { fileURLToPath, pathToFileURL } from "node:url";

export function resolveArgvPath(arg: string): string {
  try {
    return fileURLToPath(arg);
  } catch {
    return fileURLToPath(pathToFileURL(arg).href);
  }
}

export function isDistModule(moduleUrl: string | URL = import.meta.url): boolean {
  const filePath = fileURLToPath(moduleUrl);
  return filePath.includes("/dist/") || filePath.includes("\\dist\\");
}

export function getWorkerScriptPath(
  moduleUrl: string | URL = import.meta.url,
): string {
  const extension = isDistModule(moduleUrl) ? "mjs" : "ts";
  return fileURLToPath(new URL(`./worker.${extension}`, moduleUrl));
}

export function isWorkerCliInvocation(
  argv: string[] = process.argv,
  moduleUrl: string | URL = import.meta.url,
): boolean {
  const invokedPath = argv[1];
  if (invokedPath === undefined) {
    return false;
  }

  const invoked = resolveArgvPath(invokedPath);
  const thisFile = fileURLToPath(moduleUrl);

  return (
    invoked === thisFile ||
    invoked.endsWith("/worker.mjs") ||
    invoked.endsWith("\\worker.mjs")
  );
}
