/**
 * Content-Security-Policy générée par requête, avec nonce.
 *
 * Le nonce autorise les scripts d'hydratation de Next.js sans ouvrir la porte
 * à `'unsafe-inline'` : un script injecté par une XSS n'aura pas le nonce et
 * sera bloqué par le navigateur.
 *
 * Fonctionne de pair avec `middleware.ts` (qui pose l'en-tête `x-nonce`) et le
 * layout racine (qui le lit pour le transmettre à Next).
 */
/**
 * Origine des fichiers téléversés (logos, bannières, photos de profil).
 *
 * Le backend NestJS sert lui-même ce qu'il stocke, sous `/files/images/…` :
 * l'URL renvoyée pour un logo d'entreprise pointe donc sur `API_URL`, pas sur
 * le bucket Google. Sans cette origine dans `img-src`, le navigateur bloque
 * l'image — le dashboard affiche alors un cadre vide, sans erreur réseau.
 *
 * Seul `img-src` s'ouvre : `connect-src` reste sur `'self'`. Afficher une image
 * publique servie par le backend n'est pas parler à l'API, le pattern BFF
 * (règle 1 de CLAUDE.md) reste entier.
 */
export function mediaOrigin(apiUrl: string | undefined): string | null {
  if (!apiUrl) return null;
  try {
    return new URL(apiUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Origines à autoriser dans `connect-src` pour la WebSocket temps réel.
 *
 * Le handshake socket.io part en HTTP puis bascule en `ws:` / `wss:` — et les
 * deux schémas doivent figurer dans la politique : un navigateur n'assimile pas
 * `wss://api.example.com` à `https://api.example.com`. On renvoie donc l'origine
 * HTTP **et** son équivalent WebSocket.
 *
 * Sans cela, la connexion échoue silencieusement en production (la CSP bloque
 * avant toute requête réseau) alors qu'elle passe en développement, où `ws:` est
 * déjà ouvert pour le Fast Refresh de Next.
 */
export function socketOrigins(socketUrl: string | undefined): string[] {
  if (!socketUrl) return [];
  try {
    const { origin, protocol, host } = new URL(socketUrl);
    const wsScheme = protocol === "https:" ? "wss:" : "ws:";
    return [origin, `${wsScheme}//${host}`];
  } catch {
    return [];
  }
}

export function buildContentSecurityPolicy({
  nonce,
  isDev,
  mediaOrigin: media,
  socketOrigins: sockets = [],
}: {
  nonce: string;
  isDev: boolean;
  /** Origine du backend, d'où proviennent les fichiers téléversés. */
  mediaOrigin?: string | null;
  /** Origines du point d'entrée temps réel (`socketOrigins()`). */
  socketOrigins?: readonly string[];
}): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    // Nécessaire pour que les navigateurs ignorant les nonces retombent sur
    // une politique fonctionnelle ; ignoré dès que 'nonce-' est reconnu.
    "'strict-dynamic'",
    // Le mode dev de Next s'appuie sur `eval` (Fast Refresh, source maps).
    ...(isDev ? ["'unsafe-eval'"] : []),
  ];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    // Tailwind et les styles inline de Next imposent 'unsafe-inline' pour CSS.
    // L'impact est faible : le CSS ne permet pas d'exécuter du script.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      ...(media ? [media] : []),
      "https://storage.googleapis.com",
      "https://firebasestorage.googleapis.com",
    ],
    "font-src": ["'self'", "data:"],
    // Le navigateur ne parle qu'à ce dashboard : l'API NestJS n'est jamais
    // appelée directement depuis le client (pattern BFF).
    //
    // SEULE exception, et elle est étroite : la WebSocket des notifications.
    // Une WebSocket ne se relaie pas à travers un route handler Next. Seul le
    // point d'entrée socket est ouvert — aucune route REST de l'API n'est
    // joignable depuis le navigateur pour autant, et le handshake exige un
    // ticket délivré côté serveur.
    "connect-src": ["'self'", ...sockets, ...(isDev ? ["ws:", "wss:"] : [])],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };

  if (!isDev) {
    directives["upgrade-insecure-requests"] = [];
  }

  return Object.entries(directives)
    .map(([directive, values]) =>
      values.length > 0 ? `${directive} ${values.join(" ")}` : directive,
    )
    .join("; ");
}
