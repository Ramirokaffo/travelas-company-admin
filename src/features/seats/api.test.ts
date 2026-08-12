import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_SEAT_FORM, type SeatFormValues } from "./schemas";

/**
 * On observe ici la **requête construite**, pas le réseau.
 *
 * Deux pièges concrets du backend s'y jouent : `CreateSeatDto.agencyId` est
 * validé par `@IsInt()` (une chaîne repart en 400), et `companyId` ne doit
 * jamais être transmis — le service le remplace par l'entreprise de l'appelant.
 */
const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/lib/api/server-api", () => ({
  apiFetch: apiFetchMock,
  apiRequest: vi.fn(),
}));

const {
  SEAT_WINDOW,
  createSeat,
  deleteSeat,
  listCompanySeats,
  setSeatActive,
  updateSeat,
} = await import("./api");

function lastCall() {
  return apiFetchMock.mock.calls.at(-1);
}

function lastQuery(): Record<string, unknown> {
  return (lastCall()?.[2]?.query ?? {}) as Record<string, unknown>;
}

function lastBody(): Record<string, unknown> {
  return (lastCall()?.[2]?.body ?? {}) as Record<string, unknown>;
}

const VALUES: SeatFormValues = {
  ...EMPTY_SEAT_FORM,
  name: "Adjamé",
  agencyId: "7",
};

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockResolvedValue({ items: [], total: null });
});

describe("listCompanySeats", () => {
  it("interroge l'endpoint cadré entreprise", async () => {
    await listCompanySeats("token");
    expect(lastCall()?.[0]).toBe("/seat/getMyCompanySeat");
  });

  // L'endpoint ne renvoie aucun total : demander un élément de plus que le
  // plafond est le seul moyen de savoir qu'il en reste.
  it("demande un élément de plus que la fenêtre affichée", async () => {
    await listCompanySeats("token");
    expect(lastQuery()).toMatchObject({ page: 0, count: SEAT_WINDOW + 1 });
  });

  it("signale la troncature et s'arrête au plafond", async () => {
    const entities = Array.from({ length: SEAT_WINDOW + 1 }, (_, index) => ({
      id: `s-${index}`,
    }));
    apiFetchMock.mockResolvedValue({ items: entities, total: null });

    const result = await listCompanySeats("token");

    expect(result.seats).toHaveLength(SEAT_WINDOW);
    expect(result.truncated).toBe(true);
  });

  it("ne signale rien tant que la fenêtre suffit", async () => {
    apiFetchMock.mockResolvedValue({ items: [{ id: "s-1" }], total: null });

    const result = await listCompanySeats("token");

    expect(result.seats).toHaveLength(1);
    expect(result.truncated).toBe(false);
  });
});

describe("createSeat", () => {
  beforeEach(() => {
    apiFetchMock.mockResolvedValue({ id: "s-1" });
  });

  it("convertit l'identifiant de gare en entier", async () => {
    await createSeat(VALUES, "token");
    expect(lastBody().agencyId).toBe(7);
  });

  // Le service écrase `companyId` par `user.company` pour un company_admin :
  // transmettre le champ n'aurait aucun effet, et suggérerait le contraire.
  it("ne transmet jamais l'entreprise ni le solde", async () => {
    await createSeat(VALUES, "token");

    for (const forbidden of ["companyId", "walletAmount"]) {
      expect(lastBody()).not.toHaveProperty(forbidden);
    }
  });

  it("omet les champs facultatifs non renseignés", async () => {
    await createSeat(VALUES, "token");

    expect(lastBody()).not.toHaveProperty("street");
    expect(lastBody()).not.toHaveProperty("lat");
    expect(lastBody()).not.toHaveProperty("long");
  });

  it("convertit les coordonnées en nombres", async () => {
    await createSeat({ ...VALUES, lat: "5.35", long: "-4.01" }, "token");
    expect(lastBody()).toMatchObject({ lat: 5.35, long: -4.01 });
  });

  // `null` — et non l'omission du champ — est ce qui rend la main au réglage de
  // l'entreprise : omettre laisserait la valeur précédente en place.
  it("envoie null pour le réglage hérité de l'entreprise", async () => {
    await createSeat(VALUES, "token");
    expect(lastBody().allowSeatNumberBook).toBeNull();

    await createSeat({ ...VALUES, allowSeatNumberBook: "no" }, "token");
    expect(lastBody().allowSeatNumberBook).toBe(false);
  });
});

describe("updateSeat", () => {
  beforeEach(() => {
    apiFetchMock.mockResolvedValue({ id: "s-1" });
  });

  it("passe par PATCH /seat/:id", async () => {
    await updateSeat("s-1", VALUES, "token");

    expect(lastCall()?.[0]).toBe("/seat/s-1");
    expect(lastCall()?.[2]).toMatchObject({ method: "PATCH" });
  });

  it("encode l'identifiant dans le chemin", async () => {
    await updateSeat("s 1/../admin", VALUES, "token");
    expect(lastCall()?.[0]).toBe("/seat/s%201%2F..%2Fadmin");
  });
});

describe("setSeatActive", () => {
  beforeEach(() => {
    apiFetchMock.mockResolvedValue({ id: "s-1" });
  });

  // Désactiver n'est pas supprimer : l'agence reste listée et réactivable.
  it("ne touche qu'au champ isActive", async () => {
    await setSeatActive("s-1", false, "token");

    expect(lastCall()?.[2]).toMatchObject({ method: "PATCH" });
    expect(lastBody()).toEqual({ isActive: false });
  });
});

describe("deleteSeat", () => {
  it("appelle la suppression logique du backend", async () => {
    apiFetchMock.mockResolvedValue(undefined);
    await deleteSeat("s-1", "token");

    expect(lastCall()?.[0]).toBe("/seat/s-1");
    expect(lastCall()?.[2]).toMatchObject({ method: "DELETE" });
  });
});
