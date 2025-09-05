export type ErrorContext = {
  area: string;
  meta?: Record<string, unknown>;
};

export function userMessageFromError(error: unknown, fallback = "Something went wrong") {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export function reportError(ctx: ErrorContext, error: unknown) {
  // Centralized error reporting (can integrate with Sentry later)
  // eslint-disable-next-line no-console
  console.error("[DIT][error]", ctx.area, ctx.meta || {}, error);
}

