/**
 * Thème clair / sombre.
 *
 * Le choix vit dans un cookie **lisible par JavaScript**, contrairement aux
 * cookies de session (règle 3 de CLAUDE.md). C'est délibéré et sans incidence :
 * une préférence d'affichage n'est pas un secret, et l'écriture côté client
 * permet de basculer instantanément, sans aller-retour serveur. Le serveur le
 * relit au rendu suivant pour servir le bon HTML d'emblée.
 *
 * Module volontairement pur (pas de `server-only`) : le layout racine et le
 * sélecteur client partagent les mêmes constantes.
 */

export const THEMES = ["light", "dark", "system"] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "system";

export const THEME_COOKIE = "travelas_theme";

/** Un an : la préférence doit survivre à une session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value as Theme);
}

/** Toute valeur inconnue (cookie forgé, ancienne version) retombe sur « système ». */
export function parseTheme(value: string | undefined | null): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

/**
 * Classe à poser sur `<html>`.
 *
 * « Système » n'en pose aucune : c'est l'absence de classe qui laisse
 * `prefers-color-scheme` décider, côté CSS comme côté variante Tailwind.
 */
export function themeClassName(theme: Theme): string | undefined {
  return theme === "system" ? undefined : theme;
}
