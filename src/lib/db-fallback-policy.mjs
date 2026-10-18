/**
 * Local JSON persistence is only a development convenience. Production must
 * fail against the configured Prisma/MySQL connection rather than silently
 * diverting writes to a second data store.
 *
 * @param {{ nodeEnv?: string, databaseUrl?: string | null, configuredFallback?: boolean }} env
 */
export function shouldStartInFallback(env) {
  if (env.nodeEnv === "production") return false;
  if (env.configuredFallback !== undefined) return env.configuredFallback;

  const url = env.databaseUrl?.trim() ?? "";
  return !url || url.includes("REPLACE_WITH_NEW") || url.includes("user:placeholder@");
}

/** @param {string | undefined} nodeEnv */
export function mayFallbackAfterPrismaError(nodeEnv) {
  return nodeEnv !== "production";
}
