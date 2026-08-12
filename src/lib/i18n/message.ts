import { useTranslations } from "next-intl";

/**
 * Traduit un message qui est peut-être une clé de catalogue.
 *
 * Deux familles de modules produisent des messages sans pouvoir les traduire :
 *
 *  - les **schémas Zod**, partagés entre le navigateur et les Server Actions,
 *    donc sans accès à un traducteur lié à la requête ;
 *  - les **Server Actions**, dont le résultat traverse la frontière serveur et
 *    ne doit pas être figé dans la langue du serveur.
 *
 * Les deux émettent des clés qualifiées (`validation.emailInvalid`,
 * `staff.actions.created`), traduites ici au moment de l'affichage. Une valeur
 * qui n'est pas une clé connue — typiquement un message venu du backend —
 * traverse la fonction inchangée.
 */
export function useTranslatedMessage(): (message?: string) => string | undefined {
  const t = useTranslations();

  return (message?: string) => {
    if (!message) return undefined;
    return t.has(message) ? t(message) : message;
  };
}
