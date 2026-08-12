import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseTableQuery } from "@/lib/api/data-table";

import { parseIncidentFilters } from "./schemas";

/**
 * Le piège de ce domaine : `GET /speed-issue` compte ses pages **à partir de
 * 1** (`skip: (page - 1) * count`), contrairement à tout le reste de l'API.
 * Appliquer la conversion habituelle sauterait silencieusement la première
 * page — ou en afficherait deux fois la même.
 */
const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/lib/api/server-api", () => ({
  apiFetch: apiFetchMock,
  apiRequest: vi.fn(),
}));

const { listCompanyIssues, listCompanySpeedIssues, listSeatIssues, resolveIssue } =
  await import("./api");

function lastCall() {
  return apiFetchMock.mock.calls.at(-1);
}

function lastQuery(): Record<string, unknown> {
  return (lastCall()?.[2]?.query ?? {}) as Record<string, unknown>;
}

const NO_FILTER = parseIncidentFilters({});

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockResolvedValue({ items: [], total: null, data: [] });
});

describe("listCompanyIssues", () => {
  it("interroge l'endpoint cadré entreprise", async () => {
    await listCompanyIssues(parseTableQuery({}), NO_FILTER, "token");
    expect(lastCall()?.[0]).toBe("/issue/myCompany");
  });

  it("convertit la page d'interface en page 0-indexée", async () => {
    await listCompanyIssues(parseTableQuery({ page: "3" }), NO_FILTER, "token");
    expect(lastQuery().page).toBe(2);
  });

  it("distingue « à traiter » de « traité » et d'« aucun filtre »", async () => {
    await listCompanyIssues(
      parseTableQuery({}),
      parseIncidentFilters({ statut: "open" }),
      "token",
    );
    expect(lastQuery().isResolved).toBe(false);

    await listCompanyIssues(
      parseTableQuery({}),
      parseIncidentFilters({ statut: "resolved" }),
      "token",
    );
    expect(lastQuery().isResolved).toBe(true);

    await listCompanyIssues(parseTableQuery({}), NO_FILTER, "token");
    expect(lastQuery()).not.toHaveProperty("isResolved");
  });
});

describe("listCompanySpeedIssues", () => {
  it("laisse la page telle quelle : cet endpoint est 1-indexé", async () => {
    await listCompanySpeedIssues(parseTableQuery({ page: "3" }), "token");
    expect(lastQuery().page).toBe(3);

    await listCompanySpeedIssues(parseTableQuery({}), "token");
    expect(lastQuery().page).toBe(1);
  });

  it("ne transmet jamais d'identifiant d'entreprise", async () => {
    await listCompanySpeedIssues(parseTableQuery({}), "token");
    expect(lastQuery()).not.toHaveProperty("companyId");
  });
});

describe("listSeatIssues", () => {
  it("filtre sur l'agence sans quitter l'endpoint cadré entreprise", async () => {
    await listSeatIssues("seat-1", "token", { limit: 5 });

    expect(lastCall()?.[0]).toBe("/issue/myCompany");
    expect(lastQuery()).toEqual({ page: 0, count: 5, seatId: "seat-1" });
  });
});

describe("resolveIssue", () => {
  /**
   * `PATCH /issue/:id` modifie le **texte** du signalement, qui appartient au
   * voyageur, et reste réservé au super_admin. L'entreprise n'agit que sur le
   * suivi, par une route distincte.
   */
  it("passe par la route de traitement et non par la mise à jour du signalement", async () => {
    await resolveIssue(
      { id: "issue-1", isResolved: true, resolutionNote: "Chauffeur reçu." },
      "token",
    );

    expect(lastCall()?.[0]).toBe("/issue/issue-1/resolution");
    expect(lastCall()?.[2]?.method).toBe("PATCH");
    expect(lastCall()?.[2]?.body).toEqual({
      isResolved: true,
      resolutionNote: "Chauffeur reçu.",
    });
  });

  it("omet la note vide plutôt que d'écrire une chaîne vide en base", async () => {
    await resolveIssue(
      { id: "issue-1", isResolved: false, resolutionNote: "" },
      "token",
    );
    expect(lastCall()?.[2]?.body).toEqual({ isResolved: false });
  });

  it("encode l'identifiant dans le chemin", async () => {
    await resolveIssue({ id: "a/b", isResolved: true, resolutionNote: "" }, "token");
    expect(lastCall()?.[0]).toBe("/issue/a%2Fb/resolution");
  });
});
