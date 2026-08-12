import "server-only";

import { paginatedSchema, type TableQuery } from "@/lib/api/data-table";
import { apiFetch } from "@/lib/api/server-api";

import {
  RATING_RANGE,
  opinionEntitySchema,
  toOpinion,
  type Opinion,
  type OpinionFilters,
} from "./schemas";

/**
 * Accès backend du domaine « avis clients » — SERVEUR UNIQUEMENT.
 *
 * `GET /opinion/myCompany` impose `filters.companyId = requireCompanyId(user)`
 * côté contrôleur : le cadrage n'est pas négociable depuis ici.
 *
 * `FilterOpinionDto` n'expose ni `orderBy` ni `order` — le service trie
 * toujours par date décroissante. Le tri n'est donc pas proposé.
 */

const opinionListSchema = paginatedSchema(opinionEntitySchema, { key: "opinions" });

export type OpinionPage = { items: Opinion[]; total: number | null };

export async function listCompanyOpinions(
  query: TableQuery,
  filters: OpinionFilters,
  accessToken: string,
): Promise<OpinionPage> {
  const range = filters.rating === "all" ? null : RATING_RANGE[filters.rating];

  const result = await apiFetch("/opinion/myCompany", opinionListSchema, {
    accessToken,
    query: {
      page: query.page - 1,
      count: query.perPage,
      withCount: true,
      ...(query.search ? { search: query.search } : {}),
      ...(range ? { minRating: range.min, maxRating: range.max } : {}),
    },
  });

  return { items: result.items.map(toOpinion), total: result.total };
}
