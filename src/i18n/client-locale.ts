import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/i18n/config";

/**
 * Pose la langue choisie dans son cookie, depuis le navigateur.
 *
 * Le cookie est **lisible par JavaScript**, contrairement aux cookies de
 * session : une préférence d'affichage n'est pas un secret, et l'écrire côté
 * client rend la bascule instantanée. Le serveur le relit au rendu suivant et
 * envoie le HTML déjà dans la bonne langue — sans script de pré-hydratation,
 * qui devrait sinon passer par le nonce CSP.
 *
 * Partagé par le sélecteur de la barre supérieure et par la page de réglages :
 * une seconde écriture du cookie ailleurs finirait par diverger sur le
 * `Max-Age` ou le `SameSite`.
 */
export function writeLocaleCookie(locale: Locale): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;

  // Reflète le changement immédiatement pour les lecteurs d'écran et la césure
  // typographique, sans attendre le retour du rendu serveur.
  document.documentElement.lang = locale;
}
