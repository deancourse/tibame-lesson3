type PrismaKnownError = {
  code: string;
  meta?: Record<string, unknown> | null;
};

export function isPrismaKnownError(err: unknown): err is PrismaKnownError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string"
  );
}
