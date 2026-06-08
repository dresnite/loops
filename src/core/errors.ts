export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isErrnoCode(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
