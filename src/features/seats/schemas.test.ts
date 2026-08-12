import { describe, expect, it } from "vitest";

import {
  EMPTY_SEAT_FORM,
  fromBookingMode,
  parseSeatFilters,
  seatFormSchema,
  toBookingMode,
  toSeatFormValues,
  toSeatSummary,
  updateSeatSchema,
  type SeatFormValues,
} from "./schemas";

const VALID: SeatFormValues = {
  ...EMPTY_SEAT_FORM,
  name: "Gare Nord Abidjan",
  agencyId: "12",
};

/** Première erreur portée par un champ, sous forme de clé de catalogue. */
function errorOn(values: SeatFormValues, field: string): string | undefined {
  const result = seatFormSchema.safeParse(values);
  return result.success
    ? undefined
    : result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("seatFormSchema", () => {
  it("accepte une agence réduite au nom et à la gare", () => {
    expect(seatFormSchema.safeParse(VALID).success).toBe(true);
  });

  // `CreateSeatDto.agencyId` est `@IsNotEmpty()` : sans gare, la requête part
  // pour revenir en 400.
  it("exige une gare de rattachement", () => {
    expect(errorOn({ ...VALID, agencyId: "" }, "agencyId")).toBe(
      "validation.agencyRequired",
    );
  });

  it("exige un nom exploitable", () => {
    expect(errorOn({ ...VALID, name: " A " }, "name")).toBe(
      "validation.seatNameRequired",
    );
    expect(errorOn({ ...VALID, name: "x".repeat(101) }, "name")).toBe(
      "validation.max100",
    );
  });

  it("borne les coordonnées", () => {
    expect(errorOn({ ...VALID, lat: "91", long: "0" }, "lat")).toBe(
      "validation.latitudeInvalid",
    );
    expect(errorOn({ ...VALID, lat: "0", long: "181" }, "long")).toBe(
      "validation.longitudeInvalid",
    );
    expect(errorOn({ ...VALID, lat: "abc", long: "0" }, "lat")).toBe(
      "validation.latitudeInvalid",
    );
  });

  // Une latitude seule ne localise rien, et le backend accepterait pourtant
  // les deux champs indépendamment.
  it("refuse une coordonnée orpheline", () => {
    expect(errorOn({ ...VALID, lat: "5.35", long: "" }, "long")).toBe(
      "validation.coordinatesIncomplete",
    );
    expect(errorOn({ ...VALID, lat: "", long: "-4.01" }, "lat")).toBe(
      "validation.coordinatesIncomplete",
    );
    expect(
      seatFormSchema.safeParse({ ...VALID, lat: "5.35", long: "-4.01" }).success,
    ).toBe(true);
  });

  it("conserve les contraintes du formulaire en édition", () => {
    expect(updateSeatSchema.safeParse({ ...VALID, id: "s-1" }).success).toBe(true);
    expect(updateSeatSchema.safeParse(VALID).success).toBe(false);
    expect(
      updateSeatSchema.safeParse({ ...VALID, id: "s-1", lat: "5.35" }).success,
    ).toBe(false);
  });
});

// `allowSeatNumberBook` est nullable en base : `null` signifie « suivre le
// réglage de l'entreprise », un état que deux valeurs ne sauraient représenter.
describe("mode de réservation", () => {
  it("fait l'aller-retour sans perdre l'état hérité", () => {
    for (const value of [null, true, false] as const) {
      expect(fromBookingMode(toBookingMode(value))).toBe(value);
    }
  });
});

describe("toSeatSummary", () => {
  it("projette la gare et sa ville", () => {
    const summary = toSeatSummary({
      id: "s-1",
      name: "Adjamé",
      isMain: true,
      agency: { id: 7, name: "Gare d'Adjamé", city: { id: 2, name: "Abidjan" } },
    });

    expect(summary.agency).toEqual({ id: 7, name: "Gare d'Adjamé", city: "Abidjan" });
    expect(summary.isMain).toBe(true);
  });

  it("retombe sur des valeurs sûres quand les champs sont absents", () => {
    const summary = toSeatSummary({ id: "s-2" });

    expect(summary).toMatchObject({
      name: null,
      agency: null,
      street: null,
      lat: null,
      long: null,
      isMain: false,
      // Colonne `default: true` côté backend : une agence sans valeur explicite
      // est en service, pas hors service.
      isActive: true,
      // `null` = hérité de l'entreprise, à ne pas confondre avec `false`.
      allowSeatNumberBook: null,
    });
  });

  // L'entité TypeORM porte `walletAmount` : il n'a rien à faire dans le bundle
  // d'une liste de configuration.
  it("n'expose pas le solde de l'agence", () => {
    const summary = toSeatSummary({ id: "s-3", walletAmount: 125_000 });
    expect(summary).not.toHaveProperty("walletAmount");
  });
});

describe("toSeatFormValues", () => {
  it("repart des valeurs vides en création", () => {
    expect(toSeatFormValues(null)).toEqual(EMPTY_SEAT_FORM);
  });

  it("convertit l'identifiant de gare en valeur de <select>", () => {
    const values = toSeatFormValues(
      toSeatSummary({ id: "s-1", name: "Adjamé", agency: { id: 7 } }),
    );

    expect(values.agencyId).toBe("7");
    expect(values.lat).toBe("");
  });
});

describe("parseSeatFilters", () => {
  it("lit le statut depuis l'URL", () => {
    expect(parseSeatFilters({ statut: "inactive" })).toEqual({ status: "inactive" });
  });

  it("retombe sur « toutes » pour une valeur inconnue", () => {
    expect(parseSeatFilters({ statut: "n'importe quoi" })).toEqual({ status: "all" });
    expect(parseSeatFilters({})).toEqual({ status: "all" });
  });
});
