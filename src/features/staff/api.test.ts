import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole } from "@/constants/roles";
import { parseTableQuery } from "@/lib/api/data-table";

import type { StaffFilters, StaffFormValues } from "./schemas";

/**
 * On observe ici la **requête construite**, pas le réseau.
 *
 * L'enjeu est un piège concret du backend : `UserFilterDto` est validé avec
 * `whitelist + forbidNonWhitelisted`. Un paramètre en trop — `orderBy` par
 * exemple — ne dégrade pas le tri : il fait échouer toute la liste en 400.
 */
const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/lib/api/server-api", () => ({
  apiFetch: apiFetchMock,
  apiRequest: vi.fn(),
}));

const { listCompanyStaff, createStaffMember, setStaffBlocked } = await import("./api");

const NO_FILTERS: StaffFilters = { role: null, status: "all" };

function lastQuery(): Record<string, unknown> {
  const call = apiFetchMock.mock.calls.at(-1);
  return (call?.[2]?.query ?? {}) as Record<string, unknown>;
}

function lastBody(): Record<string, unknown> {
  const call = apiFetchMock.mock.calls.at(-1);
  return (call?.[2]?.body ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockResolvedValue({ items: [], total: 0 });
});

describe("listCompanyStaff", () => {
  it("interroge l'endpoint cadré entreprise", async () => {
    await listCompanyStaff(parseTableQuery({}), NO_FILTERS, "token");
    expect(apiFetchMock.mock.calls.at(-1)?.[0]).toBe("/user/getMyCompanyUsers");
  });

  it("convertit la page d'interface en page 0-indexée", async () => {
    await listCompanyStaff(parseTableQuery({ page: "3" }), NO_FILTERS, "token");
    expect(lastQuery()).toMatchObject({ page: 2, count: 20, withCount: true });
  });

  // Le cœur du test : ces deux paramètres ne figurent pas dans UserFilterDto.
  it("n'envoie jamais de paramètre de tri", async () => {
    await listCompanyStaff(
      parseTableQuery({ sort: "createAt", order: "asc" }),
      NO_FILTERS,
      "token",
    );

    expect(lastQuery()).not.toHaveProperty("orderBy");
    expect(lastQuery()).not.toHaveProperty("order");
  });

  it("traduit le filtre de statut en champs backend", async () => {
    await listCompanyStaff(
      parseTableQuery({}),
      { role: null, status: "blocked" },
      "token",
    );
    expect(lastQuery()).toMatchObject({ isBlocked: true });

    await listCompanyStaff(
      parseTableQuery({}),
      { role: null, status: "active" },
      "token",
    );
    expect(lastQuery()).toMatchObject({ isBlocked: false, isActive: true });
  });

  it("omet les filtres inactifs", async () => {
    await listCompanyStaff(parseTableQuery({}), NO_FILTERS, "token");
    expect(lastQuery()).not.toHaveProperty("isBlocked");
    expect(lastQuery()).not.toHaveProperty("role");
  });

  it("relaie la recherche", async () => {
    await listCompanyStaff(parseTableQuery({ q: "koné" }), NO_FILTERS, "token");
    expect(lastQuery()).toMatchObject({ search: "koné" });
  });
});

describe("createStaffMember", () => {
  const values: StaffFormValues = {
    firstName: "Awa",
    lastName: "Koné",
    email: "AWA@Transport.Example",
    phoneNumber: "+2250700000001",
    role: UserRole.COMPANY_AGENT,
    seatId: "",
    cniNumber: "",
    lang: "fr",
  };

  beforeEach(() => {
    apiFetchMock.mockResolvedValue({ user: undefined, status: "yes" });
  });

  it("n'envoie que les champs pilotés par le formulaire", async () => {
    await createStaffMember(values, "token");

    expect(Object.keys(lastBody()).sort()).toEqual([
      "email",
      "firstName",
      "lang",
      "lastName",
      "phoneNumber",
      "role",
    ]);
  });

  // `walletAmount`, `companyId` et `sponsorshipCode` sont refusés en 401 à un
  // company_admin ; `password` ne doit jamais transiter par le dashboard.
  it("n'envoie aucun champ réservé à la plateforme", async () => {
    await createStaffMember(values, "token");

    for (const forbidden of [
      "walletAmount",
      "plateformAmount",
      "companyId",
      "sponsorshipCode",
      "password",
      "isBlocked",
    ]) {
      expect(lastBody()).not.toHaveProperty(forbidden);
    }
  });

  it("normalise l'e-mail en minuscules", async () => {
    await createStaffMember(values, "token");
    expect(lastBody().email).toBe("awa@transport.example");
  });

  it("omet une agence non renseignée plutôt que d'envoyer une chaîne vide", async () => {
    await createStaffMember(values, "token");
    expect(lastBody()).not.toHaveProperty("seatId");

    await createStaffMember({ ...values, seatId: "s-1" }, "token");
    expect(lastBody()).toMatchObject({ seatId: "s-1" });
  });
});

describe("setStaffBlocked", () => {
  beforeEach(() => {
    apiFetchMock.mockResolvedValue({ user: undefined });
  });

  // Le module `user-permission` du backend est un squelette non implémenté :
  // le blocage doit passer par le seul chemin cloisonné par entreprise.
  it("passe par PATCH /user/:id", async () => {
    await setStaffBlocked("u-9", true, "token");

    const call = apiFetchMock.mock.calls.at(-1);
    expect(call?.[0]).toBe("/user/u-9");
    expect(call?.[2]).toMatchObject({ method: "PATCH", body: { isBlocked: true } });
  });

  it("encode l'identifiant dans le chemin", async () => {
    await setStaffBlocked("u 9/../admin", false, "token");
    expect(apiFetchMock.mock.calls.at(-1)?.[0]).toBe("/user/u%209%2F..%2Fadmin");
  });
});
