import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import {
  APP_FORMATS,
  APP_TIME_ZONE,
  LOCALE_COOKIE,
  isLocale,
  negotiateLocale,
  type Locale,
} from "@/i18n/config";

/**
 * Résolution de la langue pour chaque rendu serveur.
 *
 * Ordre : choix explicite (cookie) → langue du navigateur → français. Le
 * `proxy.ts` n'intervient pas : aucune redirection ni réécriture d'URL n'est
 * nécessaire puisque la langue ne figure pas dans le chemin.
 */
export async function resolveLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  return negotiateLocale((await headers()).get("accept-language"));
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    // Les dates du backend sont des instants UTC : c'est ici, et seulement
    // ici, qu'elles prennent l'heure du Cameroun (voir `APP_TIME_ZONE`).
    timeZone: APP_TIME_ZONE,
    // Hérités par `NextIntlClientProvider` sans qu'on ait à les lui passer :
    // la monnaie n'est donc définie qu'à un seul endroit du dépôt.
    formats: APP_FORMATS,
  };
});
