/**
 * Variables d'environnement PUBLIQUES (inlinées dans le bundle navigateur).
 *
 * Ne jamais y placer de secret. Les accès à `process.env.NEXT_PUBLIC_*` doivent
 * être écrits littéralement pour que Next.js puisse les remplacer au build.
 */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Travelas Entreprise",

  /**
   * Point d'entrée temps réel (socket.io du backend NestJS).
   *
   * SEULE exception assumée au pattern BFF : une WebSocket ne se relaie pas à
   * travers un route handler Next sans y remonter un proxy dédié. Le navigateur
   * ouvre donc la connexion directement.
   *
   * Ce n'est pas `API_URL` remis en `NEXT_PUBLIC_` par la bande — la règle 2
   * interdit d'exposer l'URL *de données*, et rien ici ne sert à lire l'API.
   * Cette variable ne porte aucun secret (l'adresse est publique par nature),
   * et l'accès reste prouvé par un ticket à usage unique délivré côté serveur :
   * aucun jeton de session ne descend au navigateur.
   *
   * Vide, le temps réel est simplement désactivé — le centre de notification
   * continue de fonctionner au rendu serveur.
   */
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? "",
} as const;
