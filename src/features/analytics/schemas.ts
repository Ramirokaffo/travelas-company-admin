import { z } from "zod";

/**
 * Schémas du domaine « pilotage ».
 *
 * Le module `statistics` du backend enveloppe systématiquement ses réponses
 * dans `{ success: true, data: … }`. Les schémas ci-dessous déballent cette
 * enveloppe pour que le reste du dashboard ne la connaisse jamais.
 *
 * Tous les champs numériques sont tolérants : `SUM()` renvoie `null` quand
 * aucune ligne ne correspond, et MySQL renvoie les sommes de colonnes `float`
 * en **chaîne** selon le pilote. `numeric()` absorbe les trois cas plutôt que
 * de laisser un `NaN` remonter jusqu'à un axe de graphique.
 */

/** Nombre tolérant : accepte `12`, `"12.5"`, `null` et `undefined`. */
const numeric = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  });

const trend = z.enum(["up", "down", "stable"]).catch("stable");

const metricSchema = z
  .object({
    total: numeric,
    change: numeric,
    trend,
  })
  .loose();

/** Une grandeur suivie dans le temps, avec sa variation sur la période précédente. */
export type Metric = { total: number; change: number; trend: "up" | "down" | "stable" };

/**
 * `GET /statistics/dashboard`.
 *
 * `fees` n'existe que depuis le cadrage entreprise (chantier E) : les
 * déploiements antérieurs ne le renvoient pas, d'où l'optionnalité.
 */
export const dashboardStatsSchema = z
  .object({
    data: z
      .object({
        overview: z
          .object({
            users: metricSchema.optional(),
            companies: metricSchema.optional(),
            seats: metricSchema.optional(),
            tickets: metricSchema.optional(),
            revenue: metricSchema.optional(),
            fees: metricSchema.optional(),
          })
          .loose(),
      })
      .loose(),
  })
  .loose()
  .transform((payload) => payload.data.overview);

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

/** `GET /statistics/dashboard/charts/:type` — série journalière. */
export const chartSeriesSchema = z
  .object({
    data: z.array(
      z
        .object({
          date: z.string(),
          value: numeric,
        })
        .loose(),
    ),
  })
  .loose()
  .transform((payload) => payload.data);

export type SeriesPoint = { date: string; value: number };

/** `GET /statistics/top-performers/seats`. */
export const topSeatsSchema = z
  .object({
    data: z.array(
      z
        .object({
          id: z.string().nullable().optional(),
          name: z.string().nullable().optional(),
          revenue: numeric,
          tickets: numeric,
        })
        .loose(),
    ),
  })
  .loose()
  .transform((payload) =>
    payload.data
      .filter((row) => row.id)
      .map((row) => ({
        id: String(row.id),
        name: row.name ?? null,
        revenue: row.revenue,
        tickets: row.tickets,
      })),
  );

export type TopSeat = {
  id: string;
  name: string | null;
  revenue: number;
  tickets: number;
};

/** `GET /statistics/metrics`. */
export const detailedMetricsSchema = z
  .object({
    data: z
      .object({
        conversionRate: numeric,
        averageOrderValue: numeric,
        satisfactionRate: numeric,
      })
      .loose(),
  })
  .loose()
  .transform((payload) => payload.data);

export type DetailedMetrics = z.infer<typeof detailedMetricsSchema>;

/* -------------------------------------------------------------------------- */
/* Recettes journalières                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `DailyRecipeEntity`.
 *
 * Vocabulaire, source constante de confusion à la lecture du backend :
 * - `totalSeatRecipe` = recette encaissée par l'agence sur la journée ;
 * - `travelasTotalFee` = part prélevée par la plateforme ;
 * - `amount` = commission supplémentaire de l'agence sur ses billets ;
 * - `remainingAmount` = ce qu'il reste à reverser à l'agence.
 */
export const dailyRecipeSchema = z
  .object({
    id: z.string(),
    amount: numeric,
    totalSeatRecipe: numeric,
    travelasTotalFee: numeric,
    remainingAmount: numeric,
    passengerCount: numeric,
    validTicketCount: numeric,
    createAt: z.union([z.string(), z.date()]).nullable().optional(),
    seat: z
      .object({ id: z.string(), name: z.string().nullable().optional() })
      .loose()
      .nullable()
      .optional(),
  })
  .loose();

export type DailyRecipeEntity = z.infer<typeof dailyRecipeSchema>;

export type DailyRecipe = {
  id: string;
  /** Recette encaissée par l'agence sur la journée. */
  revenue: number;
  /** Part prélevée par Travelas. */
  platformFee: number;
  /** Commission supplémentaire de l'agence. */
  seatFee: number;
  /** Reste à reverser à l'agence. */
  remaining: number;
  passengers: number;
  validTickets: number;
  date: string | null;
  seat: { id: string; name: string | null } | null;
};

export function toDailyRecipe(entity: DailyRecipeEntity): DailyRecipe {
  const createdAt = entity.createAt;

  return {
    id: entity.id,
    revenue: entity.totalSeatRecipe,
    platformFee: entity.travelasTotalFee,
    seatFee: entity.amount,
    remaining: entity.remainingAmount,
    passengers: entity.passengerCount,
    validTickets: entity.validTicketCount,
    date:
      createdAt instanceof Date
        ? createdAt.toISOString()
        : typeof createdAt === "string"
          ? createdAt
          : null,
    seat: entity.seat ? { id: entity.seat.id, name: entity.seat.name ?? null } : null,
  };
}

/** Totaux d'une liste de recettes, calculés côté serveur pour l'en-tête de page. */
export type RevenueTotals = {
  revenue: number;
  platformFee: number;
  remaining: number;
  passengers: number;
};

export function sumRecipes(recipes: readonly DailyRecipe[]): RevenueTotals {
  return recipes.reduce<RevenueTotals>(
    (totals, recipe) => ({
      revenue: totals.revenue + recipe.revenue,
      platformFee: totals.platformFee + recipe.platformFee,
      remaining: totals.remaining + recipe.remaining,
      passengers: totals.passengers + recipe.passengers,
    }),
    { revenue: 0, platformFee: 0, remaining: 0, passengers: 0 },
  );
}
