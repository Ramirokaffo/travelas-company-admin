import { createFormatter, createTranslator } from "next-intl";

import { APP_FORMATS, APP_TIME_ZONE } from "@/i18n/config";
import messages from "@/i18n/messages/fr.json";

/**
 * Remplaçant de `next-intl/server` en test.
 *
 * Deux raisons de le neutraliser, dans le même esprit que le stub
 * `server-only` :
 *
 *  1. hors d'un rendu React serveur, le vrai module se résout sur sa variante
 *     client, qui lève « `getTranslations` is not supported in Client
 *     Components » ;
 *  2. il lit la langue dans les cookies et les en-têtes de la requête, qui
 *     n'existent pas sous Vitest.
 *
 * Les messages ne sont pas simulés : c'est le catalogue français réel qui est
 * chargé, pour que les tests continuent d'assurer sur les textes affichés.
 */
const LOCALE = "fr";

export async function getLocale(): Promise<string> {
  return LOCALE;
}

export async function getMessages(): Promise<typeof messages> {
  return messages;
}

export async function getTimeZone(): Promise<string> {
  return APP_TIME_ZONE;
}

/**
 * Formateur du rendu serveur.
 *
 * Les mêmes formats nommés qu'en production (`i18n/config.ts`) : un montant
 * testé sort donc en francs CFA, comme à l'écran, et non en nombre nu.
 */
export async function getFormatter() {
  return createFormatter({
    locale: LOCALE,
    timeZone: APP_TIME_ZONE,
    formats: APP_FORMATS,
  });
}

export async function getTranslations(namespace?: string) {
  return createTranslator({
    locale: LOCALE,
    messages,
    // Le typage de `createTranslator` attend une clé littérale du catalogue ;
    // l'espace de noms n'est connu qu'à l'exécution dans un stub générique.
    namespace: namespace as never,
  });
}
