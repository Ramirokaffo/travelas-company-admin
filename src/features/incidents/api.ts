import "server-only";

import { paginatedSchema, type TableQuery } from "@/lib/api/data-table";
import { apiFetch } from "@/lib/api/server-api";

import {
  issueEntitySchema,
  speedIssueListSchema,
  toIssue,
  toSpeedIssue,
  type IncidentFilters,
  type Issue,
  type ResolveIssueValues,
  type SpeedIssue,
} from "./schemas";

/**
 * Accès backend du domaine « incidents » — SERVEUR UNIQUEMENT.
 *
 * `GET /issue/myCompany` a été ajouté au backend avec cette page. Jusque-là,
 * `IssueController` ne portait **aucun `@Roles()`** et `GET /issue` renvoyait
 * les signalements de toutes les entreprises de la plateforme à n'importe quel
 * compte authentifié, application voyageur comprise.
 *
 * ⚠️ `GET /speed-issue` compte ses pages **à partir de 1** (`skip: (page - 1) *
 * count`), contrairement à tout le reste de l'API. La conversion est faite ici,
 * et nulle part ailleurs.
 */

const issueListSchema = paginatedSchema(issueEntitySchema, { key: "issues" });

export type IssuePage = { items: Issue[]; total: number | null };
export type SpeedIssuePage = { items: SpeedIssue[]; total: number | null };

export async function listCompanyIssues(
  query: TableQuery,
  filters: IncidentFilters,
  accessToken: string,
): Promise<IssuePage> {
  const result = await apiFetch("/issue/myCompany", issueListSchema, {
    accessToken,
    query: {
      page: query.page - 1,
      count: query.perPage,
      withCount: true,
      ...(query.search ? { search: query.search } : {}),
      ...(filters.seatId ? { seatId: filters.seatId } : {}),
      ...(filters.status === "open" ? { isResolved: false } : {}),
      ...(filters.status === "resolved" ? { isResolved: true } : {}),
    },
  });

  return { items: result.items.map(toIssue), total: result.total };
}

export async function listCompanySpeedIssues(
  query: TableQuery,
  accessToken: string,
): Promise<SpeedIssuePage> {
  const result = await apiFetch("/speed-issue", speedIssueListSchema, {
    accessToken,
    query: {
      // 1-indexé côté backend : la page d'interface passe telle quelle.
      page: query.page,
      count: query.perPage,
      ...(query.search ? { search: query.search } : {}),
    },
  });

  return { items: result.data.map(toSpeedIssue), total: result.total ?? null };
}

/** Derniers signalements d'une agence, pour sa fiche de détail. */
export async function listSeatIssues(
  seatId: string,
  accessToken: string,
  { limit = 5 }: { limit?: number } = {},
): Promise<Issue[]> {
  const result = await apiFetch("/issue/myCompany", issueListSchema, {
    accessToken,
    query: { page: 0, count: limit, seatId },
  });

  return result.items.map(toIssue);
}

/**
 * Marque un signalement comme traité, ou le rouvre.
 *
 * Passe par `PATCH /issue/:id/resolution` et non `PATCH /issue/:id` : le second
 * modifie le **texte** du signalement, qui appartient au voyageur qui l'a
 * rédigé, et reste réservé au `super_admin`.
 */
export async function resolveIssue(
  values: ResolveIssueValues,
  accessToken: string,
): Promise<void> {
  await apiFetch(
    `/issue/${encodeURIComponent(values.id)}/resolution`,
    issueEntitySchema,
    {
      method: "PATCH",
      accessToken,
      body: {
        isResolved: values.isResolved,
        ...(values.resolutionNote ? { resolutionNote: values.resolutionNote } : {}),
      },
    },
  );
}
