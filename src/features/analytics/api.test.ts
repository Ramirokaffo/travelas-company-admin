import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Deux garde-fous se jouent ici :
 *
 * 1. **aucun `companyId` ne part du dashboard.** Le backend l'impose à partir
 *    du compte appelant (chantier E) ; l'envoyer laisserait croire que le
 *    cadrage est une affaire de client — ce qui était précisément la faille ;
 * 2. **une panne de statistiques ne fait pas tomber la page.** Le module
 *    `statistics` du backend est fragile ; un widget qui ne se calcule pas
 *    disparaît. Une erreur d'autorisation, elle, doit remonter.
 */
const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/lib/api/server-api", () => ({
  apiFetch: apiFetchMock,
  apiRequest: vi.fn(),
}));

const { ApiError } = await import("@/lib/api/errors");
const { getDashboardSeries, getDashboardStats, getTopSeats, listCompanyRecipes } =
  await import("./api");

function lastCall() {
  return apiFetchMock.mock.calls.at(-1);
}

function lastQuery(): Record<string, unknown> {
  return (lastCall()?.[2]?.query ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockResolvedValue({ items: [], total: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("lectures de statistiques", () => {
  it("interroge les endpoints du tableau de bord avec la seule période", async () => {
    await getDashboardStats("month", "token");
    expect(lastCall()?.[0]).toBe("/statistics/dashboard");
    expect(lastQuery()).toEqual({ period: "month" });

    await getDashboardSeries("revenue", "year", "token");
    expect(lastCall()?.[0]).toBe("/statistics/dashboard/charts/revenue");

    await getTopSeats("week", "token", { limit: 5 });
    expect(lastCall()?.[0]).toBe("/statistics/top-performers/seats");
    expect(lastQuery()).toEqual({ period: "week", limit: 5 });
  });

  it("ne transmet jamais d'identifiant d'entreprise", async () => {
    await getDashboardStats("month", "token");
    expect(lastQuery()).not.toHaveProperty("companyId");
  });

  it("dégrade en `null` quand le backend ne sait pas répondre", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("boom", 500));
    await expect(getDashboardStats("month", "token")).resolves.toBeNull();
  });

  it("laisse remonter une erreur d'autorisation", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("interdit", 403));
    await expect(getDashboardStats("month", "token")).rejects.toThrow("interdit");
  });
});

describe("listCompanyRecipes", () => {
  it("interroge l'endpoint cadré entreprise", async () => {
    await listCompanyRecipes({ page: 0, count: 20 }, "token");
    expect(lastCall()?.[0]).toBe("/daily-recipe/myCompany");
  });

  it("demande le total par défaut", async () => {
    await listCompanyRecipes({ page: 0, count: 20 }, "token");
    expect(lastQuery().withCount).toBe(true);
  });

  // L'export CSV enchaîne les pages : il n'a besoin du total sur aucune d'elles.
  it("permet de renoncer au total", async () => {
    await listCompanyRecipes({ page: 0, count: 100, withCount: false }, "token");
    expect(lastQuery().withCount).toBe(false);
  });

  it("omet les filtres vides plutôt que d'envoyer des chaînes nulles", async () => {
    await listCompanyRecipes(
      { page: 0, count: 20, seatId: null, startDate: null },
      "token",
    );

    const query = lastQuery();
    expect(query).not.toHaveProperty("seatId");
    expect(query).not.toHaveProperty("startDate");
  });

  it("relaie le filtre d'agence tel quel", async () => {
    await listCompanyRecipes({ page: 1, count: 50, seatId: "seat-1" }, "token");

    const query = lastQuery();
    expect(query.seatId).toBe("seat-1");
    expect(query.page).toBe(1);
    expect(query.count).toBe(50);
  });
});
