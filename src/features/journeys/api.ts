import "server-only";

import { paginatedSchema, type TableQuery } from "@/lib/api/data-table";
import { apiFetch } from "@/lib/api/server-api";

import {
  journeyEntitySchema,
  toJourney,
  type Journey,
  type JourneyFilters,
} from "./schemas";

/**
 * Accès backend du domaine « trajets » — SERVEUR UNIQUEMENT.
 *
 * ⚠️ `toBackendQuery()` n'est **pas** utilisable ici : il ajoute un paramètre
 * `search`, absent de `FindCompanyJourneyDto`. Le `ValidationPipe` global est
 * en `forbidNonWhitelisted` — la requête échouerait en 400 au lieu d'ignorer le
 * paramètre. La conversion « page 1-indexée → 0-indexée » est donc refaite ici,
 * explicitement.
 *
 * Le cadrage entreprise est imposé par le contrôleur
 * (`findCompanyJourneyDto.companyId = requireCompanyId(user)`) : aucun
 * identifiant d'entreprise ne part d'ici.
 */

const journeyListSchema = paginatedSchema(journeyEntitySchema);

export type JourneyPage = { items: Journey[]; total: number | null };

export async function listCompanyJourneys(
  query: TableQuery,
  filters: JourneyFilters,
  accessToken: string,
): Promise<JourneyPage> {
  const result = await apiFetch(
    "/company-journey/getMyCompanyJourneys",
    journeyListSchema,
    {
      accessToken,
      query: {
        page: query.page - 1,
        count: query.perPage,
        withCount: true,
        ...(query.sortBy
          ? { orderBy: query.sortBy, order: query.sortOrder.toUpperCase() }
          : { orderBy: "travelDate", order: "DESC" }),
        ...(filters.seatId ? { seatId: filters.seatId } : {}),
        ...(filters.visibility === "hidden" ? { isHidden: true } : {}),
        ...(filters.visibility === "visible" ? { isHidden: false } : {}),
        ...(filters.travelClass === "vip" ? { isVIP: true } : {}),
        ...(filters.travelClass === "standard" ? { isVIP: false } : {}),
      },
    },
  );

  return { items: result.items.map(toJourney), total: result.total };
}

/**
 * Trajets d'une agence, pour sa fiche de détail.
 *
 * `GET /company-journey/bySeat/:seatId` est cadré par le backend, mais **sans**
 * `assertSameCompany` : il se contente d'ajouter `seatId` au filtre. Le seul
 * garde-fou est donc que l'identifiant vienne d'une liste déjà cadrée
 * entreprise — c'est pourquoi la fiche d'agence charge l'agence avant ses
 * trajets, et non l'inverse.
 */
export async function listSeatJourneys(
  seatId: string,
  accessToken: string,
  { limit = 5 }: { limit?: number } = {},
): Promise<Journey[]> {
  const result = await apiFetch(
    `/company-journey/bySeat/${encodeURIComponent(seatId)}`,
    journeyListSchema,
    {
      accessToken,
      query: { page: 0, count: limit, orderBy: "travelDate", order: "DESC" },
    },
  );

  return result.items.map(toJourney);
}
