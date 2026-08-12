import "server-only";

import type { z } from "zod";

import { serverEnv } from "@/lib/config/env";

import { ApiError, toApiError } from "./errors";

/**
 * Client HTTP vers l'API NestJS — SERVEUR UNIQUEMENT.
 *
 * Toute la communication avec le backend passe par ici (pattern BFF) :
 * - le navigateur ne connaît jamais l'URL ni le token de l'API ;
 * - le token d'accès reste dans un cookie `httpOnly` illisible par JavaScript,
 *   ce qui neutralise le vol de session par XSS ;
 * - la validation Zod de chaque réponse empêche de propager des données non
 *   conformes (et documente le contrat réel du backend).
 */

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Corps JSON. Ignoré si `formData` est fourni. */
  body?: unknown;
  /** Corps multipart (upload de logo, photo de profil…). */
  formData?: FormData;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Token d'accès à transmettre en `Authorization: Bearer`. */
  accessToken?: string | null;
  /** Politique de cache Next.js. Par défaut : aucune (données d'admin). */
  cache?: RequestCache;
  next?: { revalidate?: number; tags?: string[] };
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(
    path.startsWith("/") ? path.slice(1) : path,
    serverEnv.API_URL.endsWith("/") ? serverEnv.API_URL : `${serverEnv.API_URL}/`,
  );

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/** Exécute une requête vers l'API et renvoie la réponse brute. */
export async function apiRequest(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const {
    method = "GET",
    body,
    formData,
    query,
    accessToken,
    cache,
    next,
    signal,
  } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (!formData && body !== undefined) headers["Content-Type"] = "application/json";

  // Garde-fou : une requête bloquée ne doit pas immobiliser un worker Next.
  const timeout = AbortSignal.timeout(serverEnv.API_TIMEOUT_MS);
  const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: abortSignal,
      // Les données d'administration ne sont jamais mises en cache par défaut.
      cache: cache ?? (next ? undefined : "no-store"),
      ...(next ? { next } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError("Le backend n'a pas répondu dans le délai imparti.", 504);
    }
    throw new ApiError("Impossible de joindre le service Travelas.", 502, {
      details: error,
    });
  }
}

/**
 * Requête + validation du corps JSON.
 *
 * @throws {ApiError} si le statut HTTP est en échec ou si la réponse ne
 *   correspond pas au schéma attendu.
 */
export async function apiFetch<TSchema extends z.ZodType>(
  path: string,
  schema: TSchema,
  options: RequestOptions = {},
): Promise<z.infer<TSchema>> {
  const response = await apiRequest(path, options);

  if (!response.ok) {
    throw await toApiError(response);
  }

  const payload: unknown = await response.json().catch(() => undefined);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    // Le contrat backend a changé : on échoue explicitement plutôt que de
    // laisser une valeur `undefined` remonter jusqu'à l'interface.
    throw new ApiError(`Réponse inattendue du backend sur ${path}`, 502, {
      details: parsed.error.issues,
    });
  }

  return parsed.data;
}
