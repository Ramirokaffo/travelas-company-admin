/**
 * Remplacement du paquet `server-only` sous Vitest.
 *
 * Le paquet réel lève une exception à l'import hors contexte serveur ; c'est le
 * garde-fou qui empêche un composant client d'aspirer la couche serveur. Les
 * tests, eux, doivent pouvoir importer ces modules — d'où ce module vide, câblé
 * uniquement dans `vitest.config.mts`.
 */
export {};
