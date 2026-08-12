import { NextResponse, type NextRequest } from "next/server";

import { ROUTES, isPublicRoute } from "@/constants/routes";
import { buildContentSecurityPolicy, mediaOrigin } from "@/lib/security/csp";

/**
 * Proxy (ex-`middleware`, renommé dans Next 16) — première ligne de défense.
 *
 * Il assure trois choses :
 *  1. une politique CSP à nonce sur chaque réponse HTML ;
 *  2. un contrôle de présence de session *fail-closed* : toute route non
 *     déclarée publique exige un cookie de session ;
 *  3. la redirection des utilisateurs déjà connectés hors des pages publiques.
 *
 * IMPORTANT : ce fichier ne vérifie NI la signature du token NI le rôle. Il ne
 * peut pas contacter la base et ne s'exécute pas sur les Server Actions.
 * L'autorisation réelle est faite par `requireSession()` /
 * `requireCompanySession()` dans chaque layout, page et action.
 */

const ACCESS_TOKEN_COOKIE = "travelas_at";

/**
 * Origine des fichiers servis par le backend, pour `img-src`.
 *
 * Lue ici et non via `lib/config/env` : ce module s'exécute sur le runtime du
 * proxy, où seules les variables inlinées au build sont disponibles. Seule
 * l'**origine** en est extraite — le chemin de l'API ne fuite pas dans un
 * en-tête public.
 */
const MEDIA_ORIGIN = mediaOrigin(process.env.API_URL);

/** Génère un nonce CSP (128 bits, base64) avec la Web Crypto API. */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildContentSecurityPolicy({ nonce, isDev, mediaOrigin: MEDIA_ORIGIN });

  // Le nonce est transmis au rendu via un en-tête de requête, lu par le layout.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const withSecurityHeaders = (response: NextResponse): NextResponse => {
    response.headers.set("content-security-policy", csp);
    return response;
  };

  const hasSessionCookie = Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);

  // Racine : aiguillage vers le dashboard ou la connexion.
  if (pathname === ROUTES.home) {
    const target = hasSessionCookie ? ROUTES.dashboard : ROUTES.login;
    return withSecurityHeaders(NextResponse.redirect(new URL(target, request.url)));
  }

  // Pages publiques : on empêche un utilisateur connecté d'y revenir.
  if (isPublicRoute(pathname)) {
    if (hasSessionCookie && pathname !== ROUTES.forgotPassword) {
      return withSecurityHeaders(
        NextResponse.redirect(new URL(ROUTES.dashboard, request.url)),
      );
    }
    return withSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  // Tout le reste est protégé (fail-closed).
  if (!hasSessionCookie) {
    const loginUrl = new URL(ROUTES.login, request.url);
    // `callbackUrl` est une URL relative reconstruite côté serveur : aucune
    // valeur externe n'est reprise, ce qui évite une redirection ouverte.
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
  );
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf :
     * - /api/auth/*  (connexion, déconnexion : gérées par leurs handlers)
     * - les assets statiques et fichiers d'image
     */
    {
      source:
        "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
