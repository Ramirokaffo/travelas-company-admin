import "server-only";

import { publicEnv } from "@/lib/config/public-env";

/**
 * Défense CSRF en profondeur.
 *
 * `SameSite=Lax` empêche déjà le navigateur d'envoyer les cookies de session
 * sur une requête cross-site non-GET. On refuse en plus explicitement toute
 * mutation dont l'en-tête `Origin` ne correspond pas à ce dashboard, ce qui
 * couvre les navigateurs anciens et les requêtes forgées côté serveur.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");

  // Certains clients n'envoient pas `Origin` sur les navigations same-origin ;
  // on se rabat alors sur `Referer`, et on refuse si les deux sont absents.
  const candidate = origin ?? request.headers.get("referer");
  if (!candidate) {
    throw new CsrfError("En-tête Origin manquant.");
  }

  let candidateOrigin: string;
  try {
    candidateOrigin = new URL(candidate).origin;
  } catch {
    throw new CsrfError("En-tête Origin invalide.");
  }

  const allowed = new Set<string>([new URL(publicEnv.appUrl).origin]);

  // L'hôte réellement servi (utile derrière un proxy / domaine de préproduction).
  const host = request.headers.get("host");
  if (host) {
    const protocol =
      request.headers.get("x-forwarded-proto") ??
      new URL(request.url).protocol.replace(":", "");
    allowed.add(`${protocol}://${host}`);
  }

  if (!allowed.has(candidateOrigin)) {
    // Clé de catalogue : le message est traduit par le route handler qui
    // attrape l'erreur, dans la langue de la requête.
    throw new CsrfError("errors.forbiddenOrigin");
  }
}

export class CsrfError extends Error {
  readonly status = 403;

  constructor(message: string) {
    super(message);
    this.name = "CsrfError";
  }
}
