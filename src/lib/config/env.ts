import "server-only";

import { z } from "zod";

/**
 * Variables d'environnement SERVEUR.
 *
 * Validées au démarrage : une configuration incomplète fait échouer le build
 * ou le boot plutôt que de produire des erreurs silencieuses en production
 * (ex. `API_URL` undefined -> requêtes vers "undefined/auth/login").
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** URL de l'API NestJS. Jamais exposée au navigateur. */
  API_URL: z.url({ error: "API_URL doit être une URL absolue valide" }),

  API_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  /** Force l'attribut `Secure` sur les cookies hors production. */
  FORCE_SECURE_COOKIES: z
    .enum(["0", "1"])
    .default("0")
    .transform((value) => value === "1"),
});

function loadServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    API_URL: process.env.API_URL,
    API_TIMEOUT_MS: process.env.API_TIMEOUT_MS,
    FORCE_SECURE_COOKIES: process.env.FORCE_SECURE_COOKIES,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Variables d'environnement serveur invalides :\n${details}\n\nVoir .env.example`,
    );
  }

  return parsed.data;
}

export const serverEnv = loadServerEnv();

/** `true` si les cookies doivent porter l'attribut `Secure`. */
export const useSecureCookies =
  serverEnv.NODE_ENV === "production" || serverEnv.FORCE_SECURE_COOKIES;

export const isProduction = serverEnv.NODE_ENV === "production";
