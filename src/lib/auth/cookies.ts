import "server-only";

import { cookies } from "next/headers";

import { useSecureCookies } from "@/lib/config/env";

/**
 * Gestion des cookies de session.
 *
 * Les deux tokens sont `httpOnly` : ils sont donc inaccessibles à
 * `document.cookie` et ne peuvent pas être exfiltrés par une XSS.
 * `sameSite: "lax"` bloque leur envoi sur les requêtes cross-site de type
 * formulaire/POST, ce qui couvre l'essentiel du risque CSRF ; la vérification
 * d'origine (`lib/security/origin.ts`) complète cette protection.
 */

export const ACCESS_TOKEN_COOKIE = "travelas_at";
export const REFRESH_TOKEN_COOKIE = "travelas_rt";

/** Durée de vie du cookie porteur du refresh token (30 jours). */
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/** Durée de vie du cookie porteur de l'access token (12 heures). */
const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 12;

export type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
};

/**
 * Type structurel compatible à la fois avec le store de `cookies()` et avec
 * `NextResponse.cookies` (middleware), sans dépendre des chemins internes de Next.
 */
export type CookieJar = {
  set(name: string, value: string, options?: CookieOptions): unknown;
  delete(options: { name: string; path?: string }): unknown;
};

const baseCookieOptions = {
  httpOnly: true,
  secure: useSecureCookies,
  sameSite: "lax",
  path: "/",
} as const;

/** Écrit les cookies de session sur une réponse (route handler ou middleware). */
export function setSessionCookies(
  jar: CookieJar,
  tokens: { accessToken: string; refreshToken: string },
): void {
  jar.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_MAX_AGE_SECONDS,
  });
  jar.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookies(jar: CookieJar): void {
  jar.delete({ name: ACCESS_TOKEN_COOKIE, path: "/" });
  jar.delete({ name: REFRESH_TOKEN_COOKIE, path: "/" });
}

/** Lit l'access token depuis la requête courante (Server Component / handler). */
export async function readAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function readRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}
