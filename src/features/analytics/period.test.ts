import { describe, expect, it } from "vitest";

import { DEFAULT_PERIOD, PERIOD_PARAM, parsePeriod, periodGranularity } from "./period";

describe("parsePeriod", () => {
  it("accepte les périodes connues du backend", () => {
    expect(parsePeriod({ [PERIOD_PARAM]: "year" })).toBe("year");
    expect(parsePeriod({ [PERIOD_PARAM]: "today" })).toBe("today");
  });

  /**
   * La valeur finit dans un `@IsEnum()` côté NestJS : une chaîne libre venue de
   * l'URL ferait échouer la requête en 400 au lieu d'être ignorée.
   */
  it("retombe sur la période par défaut pour une valeur inconnue", () => {
    expect(parsePeriod({ [PERIOD_PARAM]: "decennie" })).toBe(DEFAULT_PERIOD);
    expect(parsePeriod({ [PERIOD_PARAM]: "" })).toBe(DEFAULT_PERIOD);
    expect(parsePeriod({})).toBe(DEFAULT_PERIOD);
  });

  // `custom` existe côté backend mais exige `startDate` et `endDate` : le
  // laisser passer produirait une plage vide, pas une erreur visible.
  it("refuse la période personnalisée, qui n'est pas exposée", () => {
    expect(parsePeriod({ [PERIOD_PARAM]: "custom" })).toBe(DEFAULT_PERIOD);
  });

  it("ne retient que la première valeur d'un paramètre répété", () => {
    expect(parsePeriod({ [PERIOD_PARAM]: ["week", "year"] })).toBe("week");
  });
});

describe("periodGranularity", () => {
  it("regroupe les longues périodes pour garder un axe lisible", () => {
    expect(periodGranularity("year")).toBe("month");
    expect(periodGranularity("quarter")).toBe("week");
  });

  it("garde le jour sur les périodes courtes", () => {
    expect(periodGranularity("today")).toBe("day");
    expect(periodGranularity("week")).toBe("day");
    expect(periodGranularity("month")).toBe("day");
  });
});
