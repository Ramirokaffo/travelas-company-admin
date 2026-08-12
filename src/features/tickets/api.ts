import "server-only";

import { paginatedSchema, type TableQuery } from "@/lib/api/data-table";
import { apiFetch } from "@/lib/api/server-api";

import {
  ticketEntitySchema,
  toTicket,
  type Ticket,
  type TicketFilters,
} from "./schemas";

/**
 * Accès backend du domaine « billets » — SERVEUR UNIQUEMENT.
 *
 * Deux pièges de `FindTicketDto`, qui interdisent d'utiliser
 * `toBackendQuery()` tel quel :
 *
 * 1. **les booléens n'en sont pas.** `isPaid`, `isReservation` et `withCount`
 *    sont validés par `@IsEnum(["0", "1"])` : envoyer `true` produit une 400.
 * 2. **`orderBy` n'accepte que `TicketFilterEnum`**, dont les valeurs
 *    (`travelDate`, `amount`, `placeCount`…) désignent en réalité des colonnes
 *    du **trajet**, pas du billet. Le service ne les applique d'ailleurs qu'à
 *    la variante avec recherche ; l'ordre reste `createAt DESC` sinon. Le tri
 *    n'est donc pas exposé.
 *
 * Le cadrage entreprise est imposé par le contrôleur
 * (`findTicketDto.companyId = requireCompanyId(user)`).
 */

const ticketListSchema = paginatedSchema(ticketEntitySchema);

export type TicketPage = { items: Ticket[]; total: number | null };

export async function listCompanyTickets(
  query: TableQuery,
  filters: TicketFilters,
  accessToken: string,
): Promise<TicketPage> {
  const result = await apiFetch("/ticket/getMyCompanyTickets", ticketListSchema, {
    accessToken,
    query: {
      page: query.page - 1,
      count: query.perPage,
      withCount: 1,
      ...(query.search ? { search: query.search } : {}),
      ...(filters.seatId ? { seatId: filters.seatId } : {}),
      ...(filters.payment === "paid" ? { isPaid: 1 } : {}),
      ...(filters.payment === "unpaid" ? { isPaid: 0 } : {}),
      ...(filters.kind === "reservation" ? { isReservation: 1 } : {}),
      ...(filters.kind === "purchase" ? { isReservation: 0 } : {}),
    },
  });

  return { items: result.items.map(toTicket), total: result.total };
}

/** Derniers billets d'une agence, pour sa fiche de détail. */
export async function listSeatTickets(
  seatId: string,
  accessToken: string,
  { limit = 5 }: { limit?: number } = {},
): Promise<Ticket[]> {
  const result = await apiFetch(
    `/ticket/bySeat/${encodeURIComponent(seatId)}`,
    ticketListSchema,
    { accessToken, query: { page: 0, count: limit } },
  );

  return result.items.map(toTicket);
}
