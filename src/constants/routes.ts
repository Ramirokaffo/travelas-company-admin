/**
 * Table centrale des routes. Le middleware et la navigation s'appuient dessus :
 * une route absente de `PUBLIC_ROUTES` est protégée par défaut (fail-closed).
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  onboarding: "/onboarding",

  dashboard: "/dashboard",
  company: "/company",
  seats: "/seats",
  staff: "/staff",
  journeys: "/journeys",
  tickets: "/tickets",
  revenue: "/revenue",
  incidents: "/incidents",
  opinions: "/opinions",
  statistics: "/statistics",
  /** Centre de notification : boîte de réception du compte connecté. */
  notifications: "/notifications",
  /** Réglages du compte : profil, adresse e-mail, mot de passe, préférences. */
  settings: "/settings",
} as const;

/** Routes accessibles sans session. Tout le reste exige une authentification. */
export const PUBLIC_ROUTES: readonly string[] = [
  ROUTES.login,
  ROUTES.register,
  ROUTES.forgotPassword,
];

/** Préfixes toujours laissés passer par le middleware. */
export const ALWAYS_ALLOWED_PREFIXES: readonly string[] = [
  "/api/auth",
  "/_next",
  "/favicon.ico",
];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
