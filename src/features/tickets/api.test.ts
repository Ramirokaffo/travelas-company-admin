import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseTableQuery } from "@/lib/api/data-table";

import { parseTicketFilters } from "./schemas";

/**
 * On observe ici la **requête construite**, pas le réseau.
 *
 * `FindTicketDto` a deux pièges qui interdisent d'utiliser `toBackendQuery()` :
 * ses drapeaux sont validés par `@IsEnum(["0", "1"])` — un booléen part en 400 —
 * et `page` y est 0-indexé alors que l'interface compte à partir de 1.
 */
const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/lib/api/server-api", () => ({
  apiFetch: apiFetchMock,
  apiRequest: vi.fn(),
}));

const { listCompanyTickets, listSeatTickets } = await import("./api");

function lastCall() {
  return apiFetchMock.mock.calls.at(-1);
}

function lastQuery(): Record<string, unknown> {
  return (lastCall()?.[2]?.query ?? {}) as Record<string, unknown>;
}

const NO_FILTER = parseTicketFilters({});

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockResolvedValue({ items: [], total: null });
});

describe("listCompanyTickets", () => {
  it("interroge l'endpoint cadré entreprise", async () => {
    await listCompanyTickets(parseTableQuery({}), NO_FILTER, "token");
    expect(lastCall()?.[0]).toBe("/ticket/getMyCompanyTickets");
  });

  it("ne transmet jamais d'identifiant d'entreprise", async () => {
    await listCompanyTickets(parseTableQuery({}), NO_FILTER, "token");
    expect(lastQuery()).not.toHaveProperty("companyId");
  });

  it("convertit la page d'interface en page 0-indexée", async () => {
    await listCompanyTickets(parseTableQuery({ page: "3" }), NO_FILTER, "token");
    expect(lastQuery().page).toBe(2);
  });

  /**
   * `withCount`, `isPaid` et `isReservation` sont des `@IsEnum(["0", "1"])` :
   * envoyer `true` produit une 400 — donc une page d'erreur, pas une liste.
   */
  it("exprime les drapeaux en 0/1 et non en booléens", async () => {
    await listCompanyTickets(
      parseTableQuery({}),
      parseTicketFilters({ paiement: "paid", type: "reservation" }),
      "token",
    );

    const query = lastQuery();
    expect(query.withCount).toBe(1);
    expect(query.isPaid).toBe(1);
    expect(query.isReservation).toBe(1);
  });

  it("distingue « impayé » d'« absence de filtre »", async () => {
    await listCompanyTickets(
      parseTableQuery({}),
      parseTicketFilters({ paiement: "unpaid" }),
      "token",
    );
    expect(lastQuery().isPaid).toBe(0);

    await listCompanyTickets(parseTableQuery({}), NO_FILTER, "token");
    expect(lastQuery()).not.toHaveProperty("isPaid");
  });

  it("relaie la recherche, seul endpoint de liste à l'accepter", async () => {
    await listCompanyTickets(parseTableQuery({ q: "Awa" }), NO_FILTER, "token");
    expect(lastQuery().search).toBe("Awa");
  });

  // `TicketFilterEnum` ne désigne que des colonnes du trajet, et le service ne
  // les applique qu'à la variante avec recherche : le tri n'est pas exposé.
  it("n'envoie aucun paramètre de tri", async () => {
    await listCompanyTickets(
      parseTableQuery({ sort: "amount", order: "asc" }),
      NO_FILTER,
      "token",
    );

    const query = lastQuery();
    expect(query).not.toHaveProperty("orderBy");
    expect(query).not.toHaveProperty("order");
  });
});

describe("listSeatTickets", () => {
  it("encode l'identifiant d'agence dans le chemin", async () => {
    await listSeatTickets("seat 1/2", "token");
    expect(lastCall()?.[0]).toBe("/ticket/bySeat/seat%201%2F2");
  });
});
