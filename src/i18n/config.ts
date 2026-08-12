/**
 * Langues de l'interface.
 *
 * La langue vit dans un cookie, pas dans l'URL : ce back-office est en
 * `noindex`, le SEO multilingue n'apporterait rien, et aucune route n'a besoin
 * d'un segment `/fr` ou `/en`. Comme le cookie de thème, il est lisible par
 * JavaScript — une préférence d'affichage n'est pas un secret.
 *
 * `fr` et `en` sont exactement les deux valeurs acceptées par le champ `lang`
 * des comptes côté backend : la préférence d'un collaborateur peut donc servir
 * de langue initiale.
 */

export const LOCALES = ["fr", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_COOKIE = "travelas_locale";

/**
 * Fuseau d'affichage de l'application.
 *
 * Le backend stocke et renvoie des instants **UTC** ; l'heure lisible par un
 * chef d'entreprise est celle du Cameroun (WAT, UTC+1, sans heure d'été). La
 * conversion appartient donc à l'affichage, jamais au stockage — c'est en la
 * confiant au pilote MySQL que le backend avait mélangé deux référentiels
 * (chantier I de PLAN.md).
 *
 * Le fuseau doit être **explicite** : sans lui, un rendu serveur (UTC) et un
 * rendu client (fuseau de la machine) formatent différemment la même date, et
 * React signale une divergence d'hydratation.
 */
export const APP_TIME_ZONE = "Africa/Douala";

/**
 * Monnaie de la plateforme : le franc CFA d'Afrique centrale.
 *
 * Le backend stocke des nombres nus, sans unité. `XAF` n'a **pas de
 * sous-unité** : `Intl` le sait et n'affiche aucune décimale, ce qui évite le
 * « 12 500,00 FCFA » qu'un formatage générique produirait.
 */
export const APP_CURRENCY = "XAF";

/**
 * Formats nommés, partagés par le serveur et le navigateur.
 *
 * Déclarés une seule fois ici puis passés à next-intl : `format.number(x,
 * "currency")` donne alors le même résultat dans un Server Component et dans
 * un composant client, sans qu'aucun appelant n'ait à connaître la monnaie.
 */
export const APP_FORMATS = {
  number: {
    currency: {
      style: "currency",
      currency: APP_CURRENCY,
      maximumFractionDigits: 0,
    },
    /** Axes et étiquettes de graphiques : « 1,2 M » plutôt que « 1 200 000 ». */
    compactCurrency: {
      style: "currency",
      currency: APP_CURRENCY,
      notation: "compact",
      maximumFractionDigits: 1,
    },
    compact: { notation: "compact", maximumFractionDigits: 1 },
    percent: { style: "percent", maximumFractionDigits: 1 },
  },
  dateTime: {
    day: { day: "numeric", month: "short" },
    date: { day: "numeric", month: "long", year: "numeric" },
    dateShort: { day: "2-digit", month: "2-digit", year: "numeric" },
    dateTime: {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  },
} as const;

/** Un an : la préférence doit survivre à une session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Libellés affichés dans le sélecteur, chacun dans sa propre langue. */
export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}

export function parseLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Choisit une langue à partir d'un en-tête `Accept-Language`.
 *
 * Négociation volontairement minimale : deux langues seulement, et le poids
 * `q` suffit à les départager. On ne compare que la sous-balise primaire, pour
 * que `en-GB` ou `fr-CA` tombent sur la bonne langue.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...parameters] = part.trim().split(";");
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith("q="));

      return {
        primary: (tag ?? "").trim().toLowerCase().split("-")[0] ?? "",
        quality: quality ? Number.parseFloat(quality.slice(2)) : 1,
      };
    })
    .filter((entry) => Number.isFinite(entry.quality))
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ranked) {
    if (isLocale(entry.primary)) return entry.primary;
  }

  return DEFAULT_LOCALE;
}
