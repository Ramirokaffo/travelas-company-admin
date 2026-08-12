import { z } from "zod";

import { agencyRefSchema } from "@/features/agencies/schemas";

/**
 * Schémas du domaine « billets » (`TicketEntity`).
 *
 * Vocabulaire des montants, à ne pas confondre :
 * - `amount` = prix du trajet annoncé par l'agence, hors frais ;
 * - `paidAmount` = ce que le voyageur a réellement réglé, frais compris ;
 * - `companyFee` = commission de l'entreprise ;
 * - `platformFee` = commission de Travelas.
 */

const numeric = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  });

const passengerSchema = z
  .object({
    id: z.string().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
    ticketNumber: z.string().nullable().optional(),
    isValid: z.boolean().optional(),
  })
  .loose();

export const ticketEntitySchema = z
  .object({
    id: z.string(),
    amount: numeric,
    paidAmount: numeric,
    placeCount: z.number().nullable().optional(),
    isPaid: z.boolean().optional(),
    isReservation: z.boolean().optional(),
    hasBag: z.boolean().optional(),
    companyFee: numeric,
    platformFee: numeric,
    createAt: z.union([z.string(), z.date()]).nullable().optional(),
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
    passengers: z.array(passengerSchema).nullable().optional(),
    companyJourney: z
      .object({
        id: z.string().optional(),
        travelDate: z.union([z.string(), z.date()]).nullable().optional(),
        seat: z
          .object({ id: z.string(), name: z.string().nullable().optional() })
          .loose()
          .nullable()
          .optional(),
        agencyFrom: agencyRefSchema.nullable().optional(),
        agencyTo: agencyRefSchema.nullable().optional(),
      })
      .loose()
      .nullable()
      .optional(),
  })
  .loose();

export type TicketEntity = z.infer<typeof ticketEntitySchema>;

/**
 * Vue projetée transmise au navigateur.
 *
 * L'acheteur est réduit à un nom et un téléphone : l'entité `user` porte
 * `password`, `salt`, `firebaseId` et le solde du portefeuille, dont rien n'a à
 * franchir la frontière serveur (règle 7 de CLAUDE.md).
 */
export type Ticket = {
  id: string;
  amount: number;
  paidAmount: number;
  placeCount: number;
  isPaid: boolean;
  isReservation: boolean;
  platformFee: number;
  companyFee: number;
  createdAt: string | null;
  travelDate: string | null;
  buyer: { name: string; phoneNumber: string | null } | null;
  seat: { id: string; name: string | null } | null;
  from: string | null;
  to: string | null;
  /** Nombre de passagers dont le billet a été validé à l'embarquement. */
  validatedCount: number;
};

function toIso(value: string | Date | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

export function toTicket(entity: TicketEntity): Ticket {
  const journey = entity.companyJourney;
  const buyerName = [entity.user?.firstName, entity.user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    id: entity.id,
    amount: entity.amount,
    paidAmount: entity.paidAmount,
    placeCount: entity.placeCount ?? 1,
    isPaid: entity.isPaid ?? false,
    isReservation: entity.isReservation ?? false,
    platformFee: entity.platformFee,
    companyFee: entity.companyFee,
    createdAt: toIso(entity.createAt),
    travelDate: toIso(journey?.travelDate),
    buyer: entity.user
      ? { name: buyerName, phoneNumber: entity.user.phoneNumber ?? null }
      : null,
    seat: journey?.seat
      ? { id: journey.seat.id, name: journey.seat.name ?? null }
      : null,
    from: journey?.agencyFrom?.city?.name ?? journey?.agencyFrom?.name ?? null,
    to: journey?.agencyTo?.city?.name ?? journey?.agencyTo?.name ?? null,
    validatedCount: (entity.passengers ?? []).filter((p) => p.isValid).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Filtres de liste                                                            */
/* -------------------------------------------------------------------------- */

export const TICKET_PAYMENT = ["all", "paid", "unpaid"] as const;
export type TicketPayment = (typeof TICKET_PAYMENT)[number];

export const TICKET_KIND = ["all", "reservation", "purchase"] as const;
export type TicketKind = (typeof TICKET_KIND)[number];

export type TicketFilters = {
  seatId: string | null;
  payment: TicketPayment;
  kind: TicketKind;
};

export const TICKET_FILTER_PARAM = {
  seat: "agence",
  payment: "paiement",
  kind: "type",
} as const;

export function parseTicketFilters(
  params: Record<string, string | string[] | undefined>,
): TicketFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const seatId = first(params[TICKET_FILTER_PARAM.seat])?.trim();
  const payment = first(params[TICKET_FILTER_PARAM.payment]);
  const kind = first(params[TICKET_FILTER_PARAM.kind]);

  return {
    seatId: seatId ? seatId : null,
    payment: TICKET_PAYMENT.includes(payment as TicketPayment)
      ? (payment as TicketPayment)
      : "all",
    kind: TICKET_KIND.includes(kind as TicketKind) ? (kind as TicketKind) : "all",
  };
}
