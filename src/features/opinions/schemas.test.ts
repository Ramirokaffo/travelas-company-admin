import { describe, expect, it } from "vitest";

import {
  OPINION_FILTER_PARAM,
  RATING_RANGE,
  opinionEntitySchema,
  parseOpinionFilters,
  toOpinion,
} from "./schemas";

const ENTITY = opinionEntitySchema.parse({
  id: "opinion-1",
  comment: "  Voyage agréable, chauffeur ponctuel.  ",
  rating: 4.5,
  createAt: "2026-08-01T18:30:00.000Z",
  user: { id: "u-1", firstName: "Awa", lastName: "Traoré" },
});

describe("toOpinion", () => {
  /**
   * Le nom complet d'un voyageur n'a aucun usage dans un back-office : il est
   * réduit à un prénom et une initiale avant même de franchir la frontière
   * serveur.
   */
  it("réduit l'auteur à son prénom et à une initiale", () => {
    const opinion = toOpinion(ENTITY);

    expect(opinion.author).toBe("Awa T.");
    expect(JSON.stringify(opinion)).not.toContain("Traoré");
  });

  it("se contente du prénom quand le nom est absent", () => {
    const opinion = toOpinion(
      opinionEntitySchema.parse({ ...ENTITY, user: { firstName: "Awa" } }),
    );

    expect(opinion.author).toBe("Awa");
  });

  it("accepte un avis sans auteur chargé", () => {
    expect(
      toOpinion(opinionEntitySchema.parse({ ...ENTITY, user: null })).author,
    ).toBeNull();
  });

  it("nettoie le commentaire et traite le vide comme une absence", () => {
    expect(toOpinion(ENTITY).comment).toBe("Voyage agréable, chauffeur ponctuel.");
    expect(
      toOpinion(opinionEntitySchema.parse({ ...ENTITY, comment: "   " })).comment,
    ).toBeNull();
  });

  // La colonne est un `float` : `4.5` est une note légitime, il ne faut ni
  // l'arrondir ni laisser passer une valeur hors barème.
  it("borne la note au barème sans l'arrondir", () => {
    expect(toOpinion(ENTITY).rating).toBe(4.5);
    expect(toOpinion(opinionEntitySchema.parse({ ...ENTITY, rating: 9 })).rating).toBe(
      5,
    );
    expect(toOpinion(opinionEntitySchema.parse({ ...ENTITY, rating: -2 })).rating).toBe(
      0,
    );
  });
});

describe("parseOpinionFilters", () => {
  it("n'applique aucun filtre par défaut", () => {
    expect(parseOpinionFilters({})).toEqual({ rating: "all" });
  });

  it("lit les tranches connues et ignore le reste", () => {
    expect(parseOpinionFilters({ [OPINION_FILTER_PARAM.rating]: "negative" })).toEqual({
      rating: "negative",
    });
    expect(parseOpinionFilters({ [OPINION_FILTER_PARAM.rating]: "atroce" })).toEqual({
      rating: "all",
    });
  });
});

describe("RATING_RANGE", () => {
  // `FilterOpinionDto` borne les deux valeurs à 0–5 : une tranche qui sortirait
  // de l'intervalle ferait échouer la requête en 400.
  it("reste dans le barème accepté par le backend", () => {
    for (const range of Object.values(RATING_RANGE)) {
      expect(range.min).toBeGreaterThanOrEqual(0);
      expect(range.max).toBeLessThanOrEqual(5);
      expect(range.min).toBeLessThanOrEqual(range.max);
    }
  });
});
