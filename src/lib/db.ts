import { PrismaClient } from "@prisma/client";
import { createLocalPrismaFallback, MODEL_NAMES } from "./local-db-fallback";
import { mayFallbackAfterPrismaError, shouldStartInFallback as shouldStartInFallbackPolicy } from "./db-fallback-policy.mjs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  localFallback: Record<string, any> | undefined;
  useFallback: boolean | undefined;
};

let rawPrisma: PrismaClient | undefined = globalForPrisma.prisma;
// Do not even read/create the local JSON store in production.
const localFallback: Record<string, any> = process.env.NODE_ENV === "production"
  ? {}
  : globalForPrisma.localFallback ?? createLocalPrismaFallback();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.localFallback = localFallback;
}

function getRawPrisma(): PrismaClient {
  if (!rawPrisma) {
    rawPrisma = new PrismaClient({
      log: process.env.ALO_PRISMA_LOG === "true" ? ["query"] : [],
    });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = rawPrisma;
  }
  return rawPrisma;
}

function shouldStartInFallback(): boolean {
  const enabled = shouldStartInFallbackPolicy({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    configuredFallback: globalForPrisma.useFallback,
  });
  globalForPrisma.useFallback = enabled;
  return enabled;
}

function shouldFallbackAfterError(error: unknown): boolean {
  if (!mayFallbackAfterPrismaError(process.env.NODE_ENV) || !isEngineOrConnectionError(error)) return false;
  globalForPrisma.useFallback = true;
  return true;
}

function isEngineOrConnectionError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return (
    msg.includes("PrismaClientInitializationError") ||
    msg.includes("PrismaClientKnownRequestError") ||
    msg.includes("Query engine") ||
    msg.includes("engine=none") ||
    msg.includes("did not initialize yet") ||
    msg.includes("Please run `prisma generate`") ||
    msg.includes("Can't reach database server") ||
    msg.includes("Connection refused") ||
    msg.includes("Environment variable not found: DATABASE_URL") ||
    msg.includes("Authentication failed against database server") ||
    msg.includes("P1000") ||
    msg.includes("P1001") ||
    msg.includes("P1002") ||
    msg.includes("P1003") ||
    msg.includes("Invalid `prisma.")
  );
}

function getFallbackMethod(target: Record<string, any>, name: string): (...args: any[]) => any {
  const method = target[name];
  if (typeof method !== "function") {
    throw new Error(`Local database fallback is disabled; ${name} cannot be served without Prisma/MySQL.`);
  }
  return method.bind(target);
}

function wrapModelDelegate(modelName: string) {
  const fallbackDelegate = localFallback[modelName];

  return new Proxy(fallbackDelegate ?? {}, {
    get(_target, prop: string) {
      return async (...args: any[]) => {
        if (!shouldStartInFallback()) {
          try {
            const prismaDelegate = (getRawPrisma() as unknown as Record<string, any>)[modelName];
            const method = prismaDelegate?.[prop];
            if (typeof method === "function") return await method.apply(prismaDelegate, args);
            if (process.env.NODE_ENV === "production") {
              throw new Error(`Prisma delegate ${modelName}.${prop} is unavailable; regenerate the Prisma Client.`);
            }
            globalForPrisma.useFallback = true;
          } catch (error) {
            if (!shouldFallbackAfterError(error)) throw error;
          }
        }
        return getFallbackMethod(fallbackDelegate ?? {}, prop)(...args);
      };
    },
  });
}

function createResilientDb(): PrismaClient {
  const delegates: Record<string, any> = {};
  for (const model of MODEL_NAMES) {
    delegates[model] = wrapModelDelegate(model);
  }

  return new Proxy({} as PrismaClient, {
    get(_target, prop: string) {
      if (prop in delegates) return delegates[prop];

      if (prop === "$queryRaw") {
        return async (...args: any[]) => {
          if (!shouldStartInFallback()) {
            try {
              const client = getRawPrisma();
              return await (client.$queryRaw as any).apply(client, args);
            } catch (error) {
              if (!shouldFallbackAfterError(error)) throw error;
            }
          }
          return getFallbackMethod(localFallback, "$queryRaw")(...args);
        };
      }

      if (prop === "$transaction") {
        return async (fnOrArray: any, options?: any) => {
          if (!shouldStartInFallback()) {
            try {
              const client = getRawPrisma();
              return await (client.$transaction as any).call(client, fnOrArray, options);
            } catch (error) {
              if (!shouldFallbackAfterError(error)) throw error;
            }
          }
          return getFallbackMethod(localFallback, "$transaction")(fnOrArray);
        };
      }

      if (prop === "$connect" || prop === "$disconnect") {
        return async (...args: any[]) => {
          if (!shouldStartInFallback()) {
            try {
              const client = getRawPrisma() as unknown as Record<string, any>;
              return await client[prop](...args);
            } catch (error) {
              if (!shouldFallbackAfterError(error)) throw error;
            }
          }
          return getFallbackMethod(localFallback, prop)(...args);
        };
      }

      if (prop in localFallback) {
        const value = localFallback[prop];
        return typeof value === "function" ? value.bind(localFallback) : value;
      }

      const client = getRawPrisma() as unknown as Record<string, any>;
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

export const db: PrismaClient = createResilientDb();
