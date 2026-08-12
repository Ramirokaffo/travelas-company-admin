import { describe, expect, it } from "vitest";

import {
  JOURNEY_FILTER_PARAM,
  JOURNEY_SORTABLE,
  journeyEntitySchema,
  parseJourneyFilters,
  toJourney,
} from "./schemas";

const ENTITY = journeyEntitySchema.parse({
  id: "journey-1",
  travelDate: "2026-08-20T06:30:00.000Z",
  amount: "7500",
  placeCount: 70,
  duration: 240,
  isVIP: true,
  isHidden: false,
  repeatDaily: true,
  allowedAction: "both",
  seat: { id: "seat-1", name: "Adjamé" },
  agencyFrom: { id: 1, name: "Gare Nord", city: { id: 10, name: "Abidjan" } },
  agencyTo: { id: 2, name: "Gare Sud", city: { id: 11, name: "Yamoussoukro" } },
});

describe("toJourney", () => {
  it("projette le trajet et ses deux gares", () => {
    const journey = toJourney(ENTITY);

    expect(journey.from).toEqual({ name: "Gare Nord", city: "Abidjan" });
    expect(journey.to).toEqual({ name: "Gare Sud", city: "Yamoussoukro" });
    expect(journey.seat).toEqual({ id: "seat-1", name: "Adjamé" });
  });

  // Le pilote MySQL renvoie les colonnes `float` en chaîne : sans conversion,
  // le montant serait concaténé au lieu d'être additionné ou formaté.
  it("convertit le montant renvoyé en chaîne", () => {
    expect(toJourney(ENTITY).amount).toBe(7500);
    expect(
      toJourney(journeyEntitySchema.parse({ ...ENTITY, amount: null })).amount,
    ).toBe(0);
  });

  it("retombe sur le paiement immédiat pour une action inconnue", () => {
    const journey = toJourney(
      journeyEntitySchema.parse({ ...ENTITY, allowedAction: "troc" }),
    );

    expect(journey.allowedAction).toBe("pay");
  });

  it("accepte un trajet dont les relations ne sont pas chargées", () => {
    const journey = toJourney(
      journeyEntitySchema.parse({
        ...ENTITY,
        seat: null,
        agencyFrom: null,
        agencyTo: null,
      }),
    );

    expect(journey.seat).toBeNull();
    expect(journey.from).toBeNull();
    expect(journey.to).toBeNull();
  });
});

describe("parseJourneyFilters", () => {
  it("n'applique aucun filtre par défaut", () => {
    expect(parseJourneyFilters({})).toEqual({
      seatId: null,
      visibility: "all",
      travelClass: "all",
    });
  });

  it("lit les filtres connus", () => {
    expect(
      parseJourneyFilters({
        [JOURNEY_FILTER_PARAM.seat]: "seat-1",
        [JOURNEY_FILTER_PARAM.visibility]: "hidden",
        [JOURNEY_FILTER_PARAM.travelClass]: "vip",
      }),
    ).toEqual({ seatId: "seat-1", visibility: "hidden", travelClass: "vip" });
  });

  it("ignore les valeurs inconnues", () => {
    expect(
      parseJourneyFilters({
        [JOURNEY_FILTER_PARAM.visibility]: "invisible",
        [JOURNEY_FILTER_PARAM.travelClass]: "première",
      }),
    ).toEqual({ seatId: null, visibility: "all", travelClass: "all" });
  });
});

describe("JOURNEY_SORTABLE", () => {
  /**
   * La valeur finit en `orderBy` dans une requête SQL du backend, filtrée par
   * `CompanyJourneyFilterEnum` : toute colonne absente de cet enum ferait
   * échouer la requête en 400.
   */
  it("ne contient que des colonnes acceptées par CompanyJourneyFilterEnum", () => {
    const backendEnum = [
      "isHidden",
      "isVIP",
      "amount",
      "allowedAction",
      "busOrder",
      "travelDate",
      "placeCount",
    ];

    for (const column of JOURNEY_SORTABLE) {
      expect(backendEnum).toContain(column);
    }
  });
});
