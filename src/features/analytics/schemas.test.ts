import { describe, expect, it } from "vitest";

import {
  chartSeriesSchema,
  dailyRecipeSchema,
  dashboardStatsSchema,
  sumRecipes,
  toDailyRecipe,
  topSeatsSchema,
} from "./schemas";

describe("dashboardStatsSchema", () => {
  it("déballe l'enveloppe { success, data } du backend", () => {
    const parsed = dashboardStatsSchema.parse({
      success: true,
      data: {
        overview: {
          revenue: { total: 125000, change: 12.5, trend: "up" },
          tickets: { total: 340, change: -3, trend: "down" },
        },
      },
    });

    expect(parsed.revenue?.total).toBe(125000);
    expect(parsed.tickets?.trend).toBe("down");
  });

  /**
   * `SUM()` renvoie `null` quand aucune ligne ne correspond, et le pilote MySQL
   * renvoie les sommes de colonnes `float` en **chaîne**. Sans cette tolérance,
   * un `NaN` finirait sur un axe de graphique.
   */
  it("absorbe les sommes nulles et les nombres renvoyés en chaîne", () => {
    const parsed = dashboardStatsSchema.parse({
      data: {
        overview: {
          revenue: { total: "125000.50", change: null, trend: "stable" },
          fees: { total: null, change: 0, trend: "stable" },
        },
      },
    });

    expect(parsed.revenue?.total).toBe(125000.5);
    expect(parsed.revenue?.change).toBe(0);
    expect(parsed.fees?.total).toBe(0);
  });

  it("retombe sur « stable » pour une tendance inconnue", () => {
    const parsed = dashboardStatsSchema.parse({
      data: { overview: { revenue: { total: 1, change: 0, trend: "sideways" } } },
    });

    expect(parsed.revenue?.trend).toBe("stable");
  });

  // Le champ `fees` n'existe que depuis le cadrage entreprise (chantier E) :
  // un backend antérieur ne le renvoie pas, et la page doit rester affichable.
  it("accepte une vue d'ensemble partielle", () => {
    expect(dashboardStatsSchema.parse({ data: { overview: {} } }).fees).toBeUndefined();
  });
});

describe("chartSeriesSchema", () => {
  it("renvoie la série telle quelle, valeurs normalisées", () => {
    const parsed = chartSeriesSchema.parse({
      data: [
        { date: "2026-08-01", value: "1200" },
        { date: "2026-08-02", value: null },
      ],
    });

    expect(parsed).toEqual([
      { date: "2026-08-01", value: 1200 },
      { date: "2026-08-02", value: 0 },
    ]);
  });
});

describe("topSeatsSchema", () => {
  it("écarte les lignes sans identifiant", () => {
    const parsed = topSeatsSchema.parse({
      data: [
        { id: "seat-1", name: "Adjamé", revenue: "9000", tickets: "12" },
        { id: null, name: null, revenue: 0, tickets: 0 },
      ],
    });

    expect(parsed).toEqual([
      { id: "seat-1", name: "Adjamé", revenue: 9000, tickets: 12 },
    ]);
  });
});

describe("toDailyRecipe", () => {
  const ENTITY = dailyRecipeSchema.parse({
    id: "recipe-1",
    amount: 500,
    totalSeatRecipe: 12000,
    travelasTotalFee: 600,
    remainingAmount: 11900,
    passengerCount: 24,
    validTicketCount: 22,
    createAt: "2026-08-12T07:00:00.000Z",
    seat: { id: "seat-1", name: "Adjamé" },
  });

  /**
   * Le vocabulaire du backend est ambigu (`amount` désigne une commission,
   * `totalSeatRecipe` la recette) : la projection le traduit une fois pour
   * toutes, et c'est ce contrat que vérifie ce test.
   */
  it("renomme les montants selon leur signification réelle", () => {
    const recipe = toDailyRecipe(ENTITY);

    expect(recipe.revenue).toBe(12000);
    expect(recipe.platformFee).toBe(600);
    expect(recipe.seatFee).toBe(500);
    expect(recipe.remaining).toBe(11900);
  });

  it("normalise la date en ISO, qu'elle arrive en chaîne ou en Date", () => {
    expect(toDailyRecipe(ENTITY).date).toBe("2026-08-12T07:00:00.000Z");

    const asDate = toDailyRecipe(
      dailyRecipeSchema.parse({
        ...ENTITY,
        createAt: new Date("2026-08-12T07:00:00Z"),
      }),
    );
    expect(asDate.date).toBe("2026-08-12T07:00:00.000Z");
  });

  it("accepte une recette dont la relation d'agence n'est pas chargée", () => {
    const recipe = toDailyRecipe(dailyRecipeSchema.parse({ ...ENTITY, seat: null }));
    expect(recipe.seat).toBeNull();
  });
});

describe("sumRecipes", () => {
  it("additionne les grandeurs de la page affichée", () => {
    const totals = sumRecipes([
      {
        id: "a",
        revenue: 1000,
        platformFee: 50,
        seatFee: 10,
        remaining: 960,
        passengers: 4,
        validTickets: 4,
        date: null,
        seat: null,
      },
      {
        id: "b",
        revenue: 2000,
        platformFee: 100,
        seatFee: 20,
        remaining: 1920,
        passengers: 8,
        validTickets: 7,
        date: null,
        seat: null,
      },
    ]);

    expect(totals).toEqual({
      revenue: 3000,
      platformFee: 150,
      remaining: 2880,
      passengers: 12,
    });
  });

  it("renvoie des zéros sur une liste vide", () => {
    expect(sumRecipes([])).toEqual({
      revenue: 0,
      platformFee: 0,
      remaining: 0,
      passengers: 0,
    });
  });
});
