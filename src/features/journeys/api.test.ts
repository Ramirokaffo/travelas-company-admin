import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseTableQuery } from "@/lib/api/data-table";

import { JOURNEY_SORTABLE, parseJourneyFilters } from "./schemas";

/**
 * `FindCompanyJourneyDto` n'expose **pas** `search`, et le `ValidationPipe`
 * global du backend est en `forbidNonWhitelisted` : un paramètre en trop fait
 * échouer la requête en 400 au lieu d'être ignoré. C'est ce que ces tests
 * verrouillent.
 */
const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/lib/api/server-api", () => ({
  apiFetch: apiFetchMock,
  apiRequest: vi.fn(),
}));

const { listCompanyJourneys, listSeatJourneys } = await import("./api");

function lastCall() {
  return apiFetchMock.mock.calls.at(-1);
}

function lastQuery(): Record<string, unknown> {
  return (lastCall()?.[2]?.query ?? {}) as Record<string, unknown>;
}

const NO_FILTER = parseJourneyFilters({});

const query = (params: Record<string, string> = {}) =>
  parseTableQuery(params, {
    sortableColumns: JOURNEY_SORTABLE,
    defaultSortBy: "travelDate",
  });

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockResolvedValue({ items: [], total: null });
});

describe("listCompanyJourneys", () => {
  it("interroge l'endpoint cadré entreprise", async () => {
    await listCompanyJourneys(query(), NO_FILTER, "token");
    expect(lastCall()?.[0]).toBe("/company-journey/getMyCompanyJourneys");
  });

  it("n'envoie jamais de paramètre `search`, absent du DTO", async () => {
    await listCompanyJourneys(query({ q: "Abidjan" }), NO_FILTER, "token");
    expect(lastQuery()).not.toHaveProperty("search");
  });

  it("ne transmet jamais d'identifiant d'entreprise", async () => {
    await listCompanyJourneys(query(), NO_FILTER, "token");
    expect(lastQuery()).not.toHaveProperty("companyId");
  });

  it("convertit la page d'interface en page 0-indexée", async () => {
    await listCompanyJourneys(query({ page: "2" }), NO_FILTER, "token");
    expect(lastQuery().page).toBe(1);
  });

  // `OrderValueEnum` attend ASC/DESC en majuscules.
  it("trie sur une colonne de la liste blanche, en majuscules", async () => {
    await listCompanyJourneys(
      query({ sort: "amount", order: "asc" }),
      NO_FILTER,
      "token",
    );

    expect(lastQuery().orderBy).toBe("amount");
    expect(lastQuery().order).toBe("ASC");
  });

  it("retombe sur la date de départ pour une colonne inconnue", async () => {
    await listCompanyJourneys(query({ sort: "busOrder" }), NO_FILTER, "token");
    expect(lastQuery().orderBy).toBe("travelDate");
  });

  it("traduit les filtres d'interface en drapeaux du DTO", async () => {
    await listCompanyJourneys(
      query(),
      parseJourneyFilters({ agence: "seat-1", visibilite: "hidden", classe: "vip" }),
      "token",
    );

    const sent = lastQuery();
    expect(sent.seatId).toBe("seat-1");
    expect(sent.isHidden).toBe(true);
    expect(sent.isVIP).toBe(true);
  });

  it("n'envoie aucun drapeau lorsque le filtre est « tous »", async () => {
    await listCompanyJourneys(query(), NO_FILTER, "token");

    const sent = lastQuery();
    expect(sent).not.toHaveProperty("isHidden");
    expect(sent).not.toHaveProperty("isVIP");
  });
});

describe("listSeatJourneys", () => {
  it("encode l'identifiant d'agence dans le chemin", async () => {
    await listSeatJourneys("seat 1/2", "token");
    expect(lastCall()?.[0]).toBe("/company-journey/bySeat/seat%201%2F2");
  });
});
