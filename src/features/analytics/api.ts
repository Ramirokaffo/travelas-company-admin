import "server-only";

import { paginatedSchema } from "@/lib/api/data-table";
import { ApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/server-api";

import type { AnalyticsPeriod } from "./period";
import {
  chartSeriesSchema,
  dailyRecipeSchema,
  dashboardStatsSchema,
  detailedMetricsSchema,
  toDailyRecipe,
  topSeatsSchema,
  type DailyRecipe,
  type DashboardStats,
  type DetailedMetrics,
  type SeriesPoint,
  type TopSeat,
} from "./schemas";

/**
 * Accès backend du domaine « pilotage » — SERVEUR UNIQUEMENT.
 *
 * ⚠️ **Aucun `companyId` n'est jamais transmis.** Le backend l'impose à partir
 * du compte appelant (`resolveScope`, chantier E) ; l'envoyer depuis ici
 * laisserait croire que le cadrage est une affaire de client, alors que c'est
 * précisément ce qui était exploitable — changer le paramètre suffisait à lire
 * le chiffre d'affaires d'un concurrent.
 *
 * Le module `statistics` du backend reste fragile (agrégats approximatifs,
 * endpoints hétérogènes). Chaque lecture est donc **tolérante à la panne** :
 * un widget qui ne peut pas se calculer disparaît, il ne fait pas tomber la
 * page entière. Une erreur d'autorisation, elle, remonte : elle signale un vrai
 * problème de session.
 */

/** Exécute une lecture non critique ; `null` si le backend ne sait pas répondre. */
async function optional<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && (error.isUnauthorized || error.isForbidden)) {
      throw error;
    }
    // Le détail part dans les journaux du serveur, jamais vers le navigateur.
    console.error("[analytics] lecture indisponible", error);
    return null;
  }
}

export async function getDashboardStats(
  period: AnalyticsPeriod,
  accessToken: string,
): Promise<DashboardStats | null> {
  return optional(() =>
    apiFetch("/statistics/dashboard", dashboardStatsSchema, {
      accessToken,
      query: { period },
    }),
  );
}

export async function getDashboardSeries(
  type: "revenue" | "passengers" | "fees",
  period: AnalyticsPeriod,
  accessToken: string,
): Promise<SeriesPoint[] | null> {
  return optional(() =>
    apiFetch(`/statistics/dashboard/charts/${type}`, chartSeriesSchema, {
      accessToken,
      query: { period },
    }),
  );
}

export async function getTopSeats(
  period: AnalyticsPeriod,
  accessToken: string,
  { limit = 6 }: { limit?: number } = {},
): Promise<TopSeat[] | null> {
  return optional(() =>
    apiFetch("/statistics/top-performers/seats", topSeatsSchema, {
      accessToken,
      query: { period, limit },
    }),
  );
}

export async function getDetailedMetrics(
  period: AnalyticsPeriod,
  accessToken: string,
): Promise<DetailedMetrics | null> {
  return optional(() =>
    apiFetch("/statistics/metrics", detailedMetricsSchema, {
      accessToken,
      query: { period },
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Recettes journalières                                                       */
/* -------------------------------------------------------------------------- */

const recipeListSchema = paginatedSchema(dailyRecipeSchema, { key: "recipes" });

export type DailyRecipePage = { items: DailyRecipe[]; total: number | null };

export type RecipeQuery = {
  /** Page **0-indexée** : ce module parle au backend, pas à l'interface. */
  page: number;
  count: number;
  seatId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  withCount?: boolean;
};

/**
 * Recettes journalières de toute l'entreprise.
 *
 * `GET /daily-recipe/myCompany` a été ajouté au backend avec cette page : les
 * routes existantes (`/seat/:seatId`, `/mySeat`) obligeaient à interroger les
 * agences une par une pour bâtir une vue consolidée — N requêtes pour une
 * page, et un total impossible à établir.
 */
export async function listCompanyRecipes(
  query: RecipeQuery,
  accessToken: string,
): Promise<DailyRecipePage> {
  const result = await apiFetch("/daily-recipe/myCompany", recipeListSchema, {
    accessToken,
    query: {
      page: query.page,
      count: query.count,
      withCount: query.withCount ?? true,
      ...(query.seatId ? { seatId: query.seatId } : {}),
      ...(query.startDate ? { startDate: query.startDate } : {}),
      ...(query.endDate ? { endDate: query.endDate } : {}),
    },
  });

  return { items: result.items.map(toDailyRecipe), total: result.total };
}
