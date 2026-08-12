/**
 * Barre latérale pliée / dépliée.
 *
 * Même mécanique que le thème (`lib/theme/theme.ts`) et pour les mêmes
 * raisons : le choix vit dans un cookie **lisible par JavaScript**, écrit par
 * le navigateur pour que le pliage soit instantané, et relu par le serveur au
 * rendu suivant afin que le HTML parte déjà à la bonne largeur — sans quoi la
 * barre s'afficherait dépliée puis se replierait après hydratation.
 *
 * Ce n'est pas une entorse à la règle 3 de CLAUDE.md : une préférence
 * d'affichage n'est pas un secret.
 *
 * Module volontairement pur (pas de `server-only`) : le layout du dashboard et
 * la barre latérale cliente partagent les mêmes constantes.
 */

export const SIDEBAR_STATES = ["expanded", "collapsed"] as const;

export type SidebarState = (typeof SIDEBAR_STATES)[number];

export const DEFAULT_SIDEBAR_STATE: SidebarState = "expanded";

export const SIDEBAR_COOKIE = "travelas_sidebar";

/** Un an : la préférence doit survivre à une session. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Toute valeur inconnue (cookie forgé, ancienne version) retombe sur « déplié ». */
export function parseSidebarState(value: string | undefined | null): SidebarState {
  return SIDEBAR_STATES.includes(value as SidebarState)
    ? (value as SidebarState)
    : DEFAULT_SIDEBAR_STATE;
}

/**
 * Écrit la préférence depuis le navigateur, sans aller-retour serveur.
 * `SameSite=Lax` suffit : il ne s'agit que d'un réglage d'affichage.
 */
export function persistSidebarState(state: SidebarState): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SIDEBAR_COOKIE}=${state}; Path=/; Max-Age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}
