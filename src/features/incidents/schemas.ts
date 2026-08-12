import { z } from "zod";

/**
 * Schémas du domaine « incidents ».
 *
 * Deux objets distincts, volontairement non fusionnés :
 *
 * - **signalement** (`IssueEntity`) : un voyageur décrit un problème sur une
 *   agence, éventuellement avec des photos. C'est du texte, à traiter ;
 * - **excès de vitesse** (`SpeedingIssueEntity`) : relevé automatique remonté
 *   par l'application mobile, rattaché à l'entreprise et non à une agence.
 *   Aucune notion de traitement côté backend.
 *
 * Les réunir dans un seul type aurait obligé à inventer des champs vides de
 * part et d'autre.
 */

const numeric = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  });

/* -------------------------------------------------------------------------- */
/* Signalements                                                                */
/* -------------------------------------------------------------------------- */

export const issueEntitySchema = z
  .object({
    id: z.string(),
    description: z.string().nullable().optional(),
    isAnonym: z.boolean().optional(),
    isResolved: z.boolean().optional(),
    resolvedAt: z.union([z.string(), z.date()]).nullable().optional(),
    resolutionNote: z.string().nullable().optional(),
    createAt: z.union([z.string(), z.date()]).nullable().optional(),
    seat: z
      .object({ id: z.string(), name: z.string().nullable().optional() })
      .loose()
      .nullable()
      .optional(),
    user: z
      .object({
        id: z.string().optional(),
        firstName: z.string().nullable().optional(),
        lastName: z.string().nullable().optional(),
        phoneNumber: z.string().nullable().optional(),
      })
      .loose()
      .nullable()
      .optional(),
    images: z
      .array(z.object({ imageUrl: z.string() }).loose())
      .nullable()
      .optional(),
  })
  .loose();

export type IssueEntity = z.infer<typeof issueEntitySchema>;

export type Issue = {
  id: string;
  description: string;
  /** `null` quand le voyageur a choisi l'anonymat — son identité ne franchit pas la frontière serveur. */
  reporter: { name: string; phoneNumber: string | null } | null;
  isResolved: boolean;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string | null;
  seat: { id: string; name: string | null } | null;
  imageCount: number;
};

function toIso(value: string | Date | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

export function toIssue(entity: IssueEntity): Issue {
  const isAnonymous = entity.isAnonym ?? false;
  const name = [entity.user?.firstName, entity.user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    id: entity.id,
    description: entity.description ?? "",
    // L'anonymat est une promesse faite au voyageur : le nom n'est pas
    // seulement masqué à l'affichage, il ne quitte pas le serveur.
    reporter:
      isAnonymous || !entity.user
        ? null
        : { name, phoneNumber: entity.user.phoneNumber ?? null },
    isResolved: entity.isResolved ?? false,
    resolvedAt: toIso(entity.resolvedAt),
    resolutionNote: entity.resolutionNote ?? null,
    createdAt: toIso(entity.createAt),
    seat: entity.seat ? { id: entity.seat.id, name: entity.seat.name ?? null } : null,
    imageCount: (entity.images ?? []).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Excès de vitesse                                                            */
/* -------------------------------------------------------------------------- */

/** `GET /speed-issue` renvoie `{ data, total }` — une forme à lui seul. */
export const speedIssueListSchema = z
  .object({
    data: z.array(
      z
        .object({
          id: z.string(),
          speed: numeric,
          lat: numeric,
          long: numeric,
          street: z.string().nullable().optional(),
          createAt: z.union([z.string(), z.date()]).nullable().optional(),
          user: z
            .object({
              firstName: z.string().nullable().optional(),
              lastName: z.string().nullable().optional(),
            })
            .loose()
            .nullable()
            .optional(),
        })
        .loose(),
    ),
    total: z.number().nullable().optional(),
  })
  .loose();

export type SpeedIssue = {
  id: string;
  speed: number;
  street: string | null;
  lat: number;
  long: number;
  createdAt: string | null;
  reporter: string | null;
};

export function toSpeedIssue(
  entity: z.infer<typeof speedIssueListSchema>["data"][number],
): SpeedIssue {
  const name = [entity.user?.firstName, entity.user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    id: entity.id,
    speed: entity.speed,
    street: entity.street ?? null,
    lat: entity.lat,
    long: entity.long,
    createdAt: toIso(entity.createAt),
    reporter: name || null,
  };
}

/* -------------------------------------------------------------------------- */
/* Filtres et actions                                                          */
/* -------------------------------------------------------------------------- */

export const INCIDENT_TABS = ["reports", "speeding"] as const;
export type IncidentTab = (typeof INCIDENT_TABS)[number];

export const INCIDENT_STATUS = ["all", "open", "resolved"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUS)[number];

export type IncidentFilters = {
  tab: IncidentTab;
  status: IncidentStatus;
  seatId: string | null;
};

export const INCIDENT_FILTER_PARAM = {
  tab: "type",
  status: "statut",
  seat: "agence",
} as const;

export function parseIncidentFilters(
  params: Record<string, string | string[] | undefined>,
): IncidentFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const tab = first(params[INCIDENT_FILTER_PARAM.tab]);
  const status = first(params[INCIDENT_FILTER_PARAM.status]);
  const seatId = first(params[INCIDENT_FILTER_PARAM.seat])?.trim();

  return {
    tab: INCIDENT_TABS.includes(tab as IncidentTab) ? (tab as IncidentTab) : "reports",
    status: INCIDENT_STATUS.includes(status as IncidentStatus)
      ? (status as IncidentStatus)
      : "all",
    seatId: seatId ? seatId : null,
  };
}

/** Corps de l'action de traitement. Validé identiquement des deux côtés. */
export const resolveIssueSchema = z.object({
  id: z.string().min(1),
  isResolved: z.boolean(),
  resolutionNote: z.string().trim().max(500, "validation.max500"),
});

export type ResolveIssueValues = z.infer<typeof resolveIssueSchema>;
