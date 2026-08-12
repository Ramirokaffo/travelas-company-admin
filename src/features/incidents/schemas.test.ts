import { describe, expect, it } from "vitest";

import {
  INCIDENT_FILTER_PARAM,
  issueEntitySchema,
  parseIncidentFilters,
  resolveIssueSchema,
  speedIssueListSchema,
  toIssue,
  toSpeedIssue,
} from "./schemas";

const ENTITY = issueEntitySchema.parse({
  id: "issue-1",
  description: "Le bus est parti avec une heure de retard.",
  isAnonym: false,
  isResolved: false,
  createAt: "2026-08-10T09:00:00.000Z",
  seat: { id: "seat-1", name: "Adjamé" },
  user: { id: "u-1", firstName: "Awa", lastName: "Traoré", phoneNumber: "+225070000" },
  images: [{ imageUrl: "https://exemple/1.jpg" }],
});

describe("toIssue", () => {
  it("projette le signalement et compte ses photos", () => {
    const issue = toIssue(ENTITY);

    expect(issue.description).toBe("Le bus est parti avec une heure de retard.");
    expect(issue.seat).toEqual({ id: "seat-1", name: "Adjamé" });
    expect(issue.imageCount).toBe(1);
    expect(issue.reporter).toEqual({ name: "Awa Traoré", phoneNumber: "+225070000" });
  });

  /**
   * L'anonymat est une promesse faite au voyageur : l'identité ne doit pas
   * seulement être masquée à l'affichage, elle ne doit pas quitter le serveur.
   */
  it("n'expose aucune identité lorsque le signalement est anonyme", () => {
    const issue = toIssue(issueEntitySchema.parse({ ...ENTITY, isAnonym: true }));

    expect(issue.reporter).toBeNull();
    expect(JSON.stringify(issue)).not.toContain("Traoré");
    expect(JSON.stringify(issue)).not.toContain("+225070000");
  });

  it("accepte un signalement dont l'auteur n'est pas chargé", () => {
    const issue = toIssue(issueEntitySchema.parse({ ...ENTITY, user: null }));
    expect(issue.reporter).toBeNull();
  });

  it("normalise la date de traitement", () => {
    const issue = toIssue(
      issueEntitySchema.parse({
        ...ENTITY,
        isResolved: true,
        resolvedAt: new Date("2026-08-11T10:00:00Z"),
        resolutionNote: "Chauffeur reçu.",
      }),
    );

    expect(issue.isResolved).toBe(true);
    expect(issue.resolvedAt).toBe("2026-08-11T10:00:00.000Z");
    expect(issue.resolutionNote).toBe("Chauffeur reçu.");
  });
});

describe("toSpeedIssue", () => {
  it("normalise les nombres renvoyés en chaîne par le pilote MySQL", () => {
    const parsed = speedIssueListSchema.parse({
      data: [
        {
          id: "speed-1",
          speed: "118",
          lat: "5.3599",
          long: "-4.0083",
          street: "Boulevard Lagunaire",
          createAt: "2026-08-09T12:00:00.000Z",
          user: { firstName: "Koffi", lastName: "N'Guessan" },
        },
      ],
      total: 1,
    });

    const issue = toSpeedIssue(parsed.data[0]!);

    expect(issue.speed).toBe(118);
    expect(issue.lat).toBeCloseTo(5.3599);
    expect(issue.reporter).toBe("Koffi N'Guessan");
  });
});

describe("parseIncidentFilters", () => {
  it("ouvre sur les signalements par défaut", () => {
    expect(parseIncidentFilters({})).toEqual({
      tab: "reports",
      status: "all",
      seatId: null,
    });
  });

  it("lit les onglets et les filtres connus", () => {
    expect(
      parseIncidentFilters({
        [INCIDENT_FILTER_PARAM.tab]: "speeding",
        [INCIDENT_FILTER_PARAM.status]: "open",
        [INCIDENT_FILTER_PARAM.seat]: " seat-1 ",
      }),
    ).toEqual({ tab: "speeding", status: "open", seatId: "seat-1" });
  });

  it("ignore les valeurs inconnues plutôt que de les relayer au backend", () => {
    expect(
      parseIncidentFilters({
        [INCIDENT_FILTER_PARAM.tab]: "sabotage",
        [INCIDENT_FILTER_PARAM.status]: "peut-être",
      }),
    ).toEqual({ tab: "reports", status: "all", seatId: null });
  });
});

describe("resolveIssueSchema", () => {
  it("accepte une note vide : le traitement peut se passer d'explication", () => {
    const parsed = resolveIssueSchema.safeParse({
      id: "issue-1",
      isResolved: true,
      resolutionNote: "",
    });

    expect(parsed.success).toBe(true);
  });

  // 500 caractères : la longueur de la colonne backend. Au-delà, la requête
  // échouerait en 400 après un aller-retour inutile.
  it("refuse une note plus longue que la colonne", () => {
    const parsed = resolveIssueSchema.safeParse({
      id: "issue-1",
      isResolved: true,
      resolutionNote: "x".repeat(501),
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("validation.max500");
  });
});
