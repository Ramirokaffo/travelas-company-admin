/**
 * Périodes d'analyse.
 *
 * Miroir de `StatisticsPeriodEnum` côté backend
 * (`src/statistics/dto/statistics-filter.dto.ts`). La valeur finit dans un
 * `@IsEnum()` : une chaîne libre venue de l'URL ferait échouer la requête en
 * 400, d'où la liste blanche et le repli sur « ce mois-ci ».
 *
 * `custom` n'est volontairement **pas** exposé : il exige `startDate` et
 * `endDate`, deux champs de plus dans l'URL et un sélecteur de dates complet.
 * Les cinq périodes prédéfinies couvrent le pilotage courant ; l'intervalle
 * libre viendra avec l'export comptable.
 *
 * Module pur : lu par les Server Components pour construire leurs requêtes et
 * par le sélecteur client pour construire ses liens.
 */

export const ANALYTICS_PERIODS = ["today", "week", "month", "quarter", "year"] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const DEFAULT_PERIOD: AnalyticsPeriod = "month";

/** Nom du paramètre d'URL. Centralisé pour rester cohérent d'une page à l'autre. */
export const PERIOD_PARAM = "periode";

export function parsePeriod(
  params: Record<string, string | string[] | undefined>,
): AnalyticsPeriod {
  const raw = params[PERIOD_PARAM];
  const value = Array.isArray(raw) ? raw[0] : raw;

  return ANALYTICS_PERIODS.includes(value as AnalyticsPeriod)
    ? (value as AnalyticsPeriod)
    : DEFAULT_PERIOD;
}

/**
 * Granularité d'affichage d'une série temporelle.
 *
 * Le backend renvoie toujours un point par jour. Sur un an, cela fait 365
 * points pour quelques centaines de pixels : les regrouper par semaine ou par
 * mois est une décision d'**affichage**, prise ici pour rester cohérente entre
 * les pages.
 */
export function periodGranularity(period: AnalyticsPeriod): "day" | "week" | "month" {
  if (period === "year") return "month";
  if (period === "quarter") return "week";
  return "day";
}
