/**
 * Variables d'environnement PUBLIQUES (inlinées dans le bundle navigateur).
 *
 * Ne jamais y placer de secret. Les accès à `process.env.NEXT_PUBLIC_*` doivent
 * être écrits littéralement pour que Next.js puisse les remplacer au build.
 */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Travelas Entreprise",
} as const;
