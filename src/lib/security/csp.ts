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

export function buildContentSecurityPolicy({
  nonce,
  isDev,
  mediaOrigin: media,
}: {
  nonce: string;
  isDev: boolean;
  /** Origine du backend, d'où proviennent les fichiers téléversés. */
  mediaOrigin?: string | null;
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
    "connect-src": ["'self'", ...(isDev ? ["ws:", "wss:"] : [])],
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
