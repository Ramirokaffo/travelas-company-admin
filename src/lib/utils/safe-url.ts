import { ROUTES } from "@/constants/routes";

/** Caractères de contrôle : tabulation, sauts de ligne, DEL. */
const CONTROL_CHARACTERS = new RegExp("[\\u0000-\\u001f\\u007f]");

/**
 * Normalise une destination de redirection venue de l'URL (`?callbackUrl=…`).
 *
 * Seuls les chemins internes sont acceptés. Laisser passer une URL absolue
 * ouvrirait une redirection ouverte : `/login?callbackUrl=https://phishing.example`
 * afficherait la page de connexion légitime puis déposerait l'utilisateur —
 * fraîchement authentifié — sur un site tiers.
 *
 * Sont refusés :
 * - les URLs absolues (`https://…`) et les schémas exotiques (`javascript:`),
 *   qui ne commencent pas par `/` ;
 * - les URLs protocol-relative (`//evil.example`), résolues comme externes par
 *   le navigateur ;
 * - l'échappement par antislash (`/\evil.example`), plusieurs navigateurs
 *   traitant `\` comme `/` ;
 * - les caractères de contrôle, qui permettent de contourner un filtre d'URL.
 */
export function safeCallbackUrl(
  value: string | string[] | undefined,
  fallback: string = ROUTES.dashboard,
): string {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw || !raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (CONTROL_CHARACTERS.test(raw)) return fallback;

  return raw;
}
