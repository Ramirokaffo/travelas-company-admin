import { z } from "zod";

import { agencyRefSchema } from "@/features/agencies/schemas";
import { TICKET_ACTIONS, type TicketAction } from "@/features/company/schemas";

/**
 * Schémas du domaine « trajets » (`CompanyJourneyEntity`).
 *
 * Un trajet appartient à une agence (`seat`) et relie deux **gares**
 * (`AgencyEntity`) — le faux ami du projet : `agency` n'est pas une agence
 * d'entreprise mais un point géographique rattaché à une ville.
 */

export const journeyEntitySchema = z
  .object({
    id: z.string(),
    travelDate: z.union([z.string(), z.date()]).nullable().optional(),
    amount: z.union([z.number(), z.string()]).nullable().optional(),
    placeCount: z.number().nullable().optional(),
    duration: z.number().nullable().optional(),
    busOrder: z.string().nullable().optional(),
    isVIP: z.boolean().optional(),
    isHidden: z.boolean().optional(),
    repeatDaily: z.boolean().optional(),
    allowedAction: z.string().nullable().optional(),
    seat: z
      .object({ id: z.string(), name: z.string().nullable().optional() })
      .loose()
      .nullable()
      .optional(),
    agencyFrom: agencyRefSchema.nullable().optional(),
    agencyTo: agencyRefSchema.nullable().optional(),
  })
  .loose();

export type JourneyEntity = z.infer<typeof journeyEntitySchema>;

/** Vue projetée transmise au navigateur. */
export type Journey = {
  id: string;
  /** Instant UTC en ISO. Le formatage à l'heure de Douala appartient à l'affichage. */
  travelDate: string | null;
  amount: number;
  placeCount: number;
  /** Durée annoncée, en minutes. */
  duration: number | null;
  isVIP: boolean;
  isHidden: boolean;
  repeatDaily: boolean;
  allowedAction: TicketAction;
  seat: { id: string; name: string | null } | null;
  from: { name: string | null; city: string | null } | null;
  to: { name: string | null; city: string | null } | null;
};

function toPlace(
  agency: JourneyEntity["agencyFrom"],
): { name: string | null; city: string | null } | null {
  if (!agency) return null;
  return { name: agency.name ?? null, city: agency.city?.name ?? null };
}

export function toJourney(entity: JourneyEntity): Journey {
  const travelDate = entity.travelDate;
  const amount = entity.amount;
  const action = entity.allowedAction;

  return {
    id: entity.id,
    travelDate:
      travelDate instanceof Date
        ? travelDate.toISOString()
        : typeof travelDate === "string"
          ? travelDate
          : null,
    amount: typeof amount === "number" ? amount : Number(amount ?? 0) || 0,
    placeCount: entity.placeCount ?? 0,
    duration: entity.duration ?? null,
    isVIP: entity.isVIP ?? false,
    isHidden: entity.isHidden ?? false,
    repeatDaily: entity.repeatDaily ?? false,
    allowedAction: TICKET_ACTIONS.includes(action as TicketAction)
      ? (action as TicketAction)
      : "pay",
    seat: entity.seat ? { id: entity.seat.id, name: entity.seat.name ?? null } : null,
    from: toPlace(entity.agencyFrom),
    to: toPlace(entity.agencyTo),
  };
}

/* -------------------------------------------------------------------------- */
/* Filtres de liste                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Colonnes de tri autorisées.
 *
 * Liste blanche obligatoire : la valeur finit en `orderBy` dans une requête SQL
 * du backend, et `CompanyJourneyFilterEnum` refuse tout le reste en 400.
 */
export const JOURNEY_SORTABLE = ["travelDate", "amount", "placeCount"] as const;

export const JOURNEY_VISIBILITY = ["all", "visible", "hidden"] as const;
export type JourneyVisibility = (typeof JOURNEY_VISIBILITY)[number];

export const JOURNEY_CLASS = ["all", "vip", "standard"] as const;
export type JourneyClass = (typeof JOURNEY_CLASS)[number];

export type JourneyFilters = {
  seatId: string | null;
  visibility: JourneyVisibility;
  travelClass: JourneyClass;
};

export const JOURNEY_FILTER_PARAM = {
  seat: "agence",
  visibility: "visibilite",
  travelClass: "classe",
} as const;

export function parseJourneyFilters(
  params: Record<string, string | string[] | undefined>,
): JourneyFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const seatId = first(params[JOURNEY_FILTER_PARAM.seat])?.trim();
  const visibility = first(params[JOURNEY_FILTER_PARAM.visibility]);
  const travelClass = first(params[JOURNEY_FILTER_PARAM.travelClass]);

  return {
    seatId: seatId ? seatId : null,
    visibility: JOURNEY_VISIBILITY.includes(visibility as JourneyVisibility)
      ? (visibility as JourneyVisibility)
      : "all",
    travelClass: JOURNEY_CLASS.includes(travelClass as JourneyClass)
      ? (travelClass as JourneyClass)
      : "all",
  };
}
