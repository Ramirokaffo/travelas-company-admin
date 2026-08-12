import { describe, expect, it } from "vitest";

import { parseTableQuery } from "@/lib/api/data-table";

import { filterSeats, selectSeatPage, sortSeats } from "./list";
import { toSeatSummary, type SeatFilters, type SeatSummary } from "./schemas";

/**
 * `GET /seat/getMyCompanySeat` ne sait ni chercher, ni trier, ni compter : tout
 * se joue ici. Ces tests valent donc contrat de la liste.
 */

const ALL: SeatFilters = { status: "all" };

function seat(partial: {
  id: string;
  name?: string | null;
  isMain?: boolean;
  isActive?: boolean;
  street?: string;
  agency?: { id: number; name?: string; city?: { id: number; name: string } };
}): SeatSummary {
  return toSeatSummary(partial);
}

const SEATS = [
  seat({ id: "1", name: "Yopougon", street: "Rue des Jardins" }),
  seat({
    id: "2",
    name: "Adjamé",
    isMain: true,
    agency: { id: 7, name: "Gare Nord", city: { id: 1, name: "Abidjan" } },
  }),
  seat({ id: "3", name: "Bouaké", isActive: false }),
  seat({ id: "4", name: null }),
];

describe("filterSeats", () => {
  it("filtre par statut", () => {
    expect(filterSeats(SEATS, { search: null }, { status: "inactive" })).toEqual([
      SEATS[2],
    ]);
    expect(filterSeats(SEATS, { search: null }, { status: "active" })).toHaveLength(3);
  });

  // La recherche porte sur ce que l'utilisateur voit dans le tableau, gare et
  // ville comprises — pas seulement sur le nom de l'agence.
  it("cherche dans le nom, l'adresse, la gare et la ville", () => {
    const search = (needle: string) =>
      filterSeats(SEATS, { search: needle }, ALL).map((item) => item.id);

    expect(search("yopougon")).toEqual(["1"]);
    expect(search("jardins")).toEqual(["1"]);
    expect(search("gare nord")).toEqual(["2"]);
    expect(search("abidjan")).toEqual(["2"]);
  });

  it("ignore accents et casse", () => {
    expect(filterSeats(SEATS, { search: "ADJAME" }, ALL).map((s) => s.id)).toEqual([
      "2",
    ]);
    expect(filterSeats(SEATS, { search: "bouaké" }, ALL).map((s) => s.id)).toEqual([
      "3",
    ]);
  });

  it("combine recherche et statut", () => {
    expect(filterSeats(SEATS, { search: "bouake" }, { status: "active" })).toHaveLength(
      0,
    );
  });
});

describe("sortSeats", () => {
  it("place l'agence principale en tête, puis trie par nom", () => {
    expect(sortSeats(SEATS, "fr").map((item) => item.name)).toEqual([
      "Adjamé",
      "Bouaké",
      "Yopougon",
      // Une agence sans nom finit la liste plutôt que de la commencer.
      null,
    ]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const input = [...SEATS];
    sortSeats(input, "fr");
    expect(input).toEqual(SEATS);
  });
});

describe("selectSeatPage", () => {
  it("découpe la page demandée et renvoie un total exact", () => {
    const page = selectSeatPage(SEATS, parseTableQuery({ perPage: "2" }), ALL, "fr");

    expect(page.items.map((item) => item.name)).toEqual(["Adjamé", "Bouaké"]);
    // Total réel, là où l'endpoint backend n'en renvoie aucun.
    expect(page.total).toBe(4);
  });

  it("compte les résultats filtrés, pas la fenêtre chargée", () => {
    const page = selectSeatPage(
      SEATS,
      parseTableQuery({}),
      { status: "inactive" },
      "fr",
    );

    expect(page.total).toBe(1);
  });

  it("renvoie une page vide au-delà du dernier résultat", () => {
    const page = selectSeatPage(
      SEATS,
      parseTableQuery({ page: "3", perPage: "2" }),
      ALL,
      "fr",
    );

    expect(page.items).toEqual([]);
    expect(page.total).toBe(4);
  });
});
