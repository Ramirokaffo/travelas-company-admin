import { z } from "zod";

import { agencyRefSchema } from "@/features/agencies/schemas";
import { seatSchema, type Seat } from "@/types/user";

/**
 * Schémas du domaine « agences » (`SeatEntity`).
 *
 * Rappel de vocabulaire : `seat` = **agence de l'entreprise**. L'entité
 * `agency` du backend désigne une gare — un point géographique partagé entre
 * entreprises, auquel une agence se rattache.
 *
 * Module volontairement pur (pas de `server-only`) : les mêmes schémas servent
 * au formulaire dans le navigateur et à la revalidation dans la Server Action.
 * La validation client est un confort, celle du serveur est la garantie. Pour
 * la même raison les messages sont des **clés de catalogue** et non du texte.
 */

/* -------------------------------------------------------------------------- */
/* Sélecteur d'agence (utilisé par /staff)                                     */
/* -------------------------------------------------------------------------- */

/** Vue minimale d'une agence, suffisante pour un sélecteur d'affectation. */
export type SeatOption = {
  id: string;
  /**
   * `null` si l'agence n'a pas de nom. Le libellé de repli est du ressort de
   * l'affichage : il dépend de la langue, que cette projection ignore.
   */
  name: string | null;
  isMain: boolean;
  isActive: boolean;
};

export function toSeatOption(entity: Seat): SeatOption {
  return {
    id: entity.id,
    name: entity.name ?? null,
    isMain: entity.isMain ?? false,
    isActive: entity.isActive ?? true,
  };
}

/* -------------------------------------------------------------------------- */
/* Réponses backend                                                            */
/* -------------------------------------------------------------------------- */

/**
 * L'entité renvoyée par `/seat/getMyCompanySeat`, `POST /seat` et
 * `PATCH /seat/:id`. La gare est chargée en relation (`agency.city`) sur les
 * lectures, mais absente des réponses d'écriture : d'où `optional()`.
 */
export const seatEntitySchema = seatSchema
  .extend({ agency: agencyRefSchema.nullable().optional() })
  .loose();

export type SeatEntity = z.infer<typeof seatEntitySchema>;

/**
 * Vue projetée transmise au navigateur.
 *
 * `walletAmount` est volontairement écarté : le solde d'une agence relève du
 * chiffre d'affaires (phase 4), pas de sa fiche d'identité, et n'a rien à faire
 * dans le bundle d'une liste de configuration.
 */
export type SeatSummary = {
  id: string;
  name: string | null;
  isMain: boolean;
  isActive: boolean;
  hasBedroom: boolean;
  /** `null` = l'agence suit le réglage de l'entreprise. */
  allowSeatNumberBook: boolean | null;
  street: string | null;
  lat: number | null;
  long: number | null;
  /** Gare de rattachement (`AgencyEntity`), `null` si la relation n'est pas chargée. */
  agency: { id: number; name: string | null; city: string | null } | null;
};

export function toSeatSummary(entity: SeatEntity): SeatSummary {
  return {
    id: entity.id,
    name: entity.name ?? null,
    isMain: entity.isMain ?? false,
    isActive: entity.isActive ?? true,
    hasBedroom: entity.hasBedroom ?? false,
    allowSeatNumberBook: entity.allowSeatNumberBook ?? null,
    street: entity.street ?? null,
    lat: entity.lat ?? null,
    long: entity.long ?? null,
    agency: entity.agency
      ? {
          id: entity.agency.id,
          name: entity.agency.name ?? null,
          city: entity.agency.city?.name ?? null,
        }
      : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Formulaire                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Réservation par numéro de siège : trois états, pas deux.
 *
 * La colonne `allowSeatNumberBook` est nullable, et `null` signifie « suivre le
 * réglage de l'entreprise ». Un booléen à deux états forcerait chaque agence à
 * trancher, y compris celles qui n'ont pas d'avis.
 */
export const SEAT_BOOKING_MODES = ["inherit", "yes", "no"] as const;
export type SeatBookingMode = (typeof SEAT_BOOKING_MODES)[number];

export function toBookingMode(value: boolean | null): SeatBookingMode {
  if (value === null) return "inherit";
  return value ? "yes" : "no";
}

export function fromBookingMode(mode: SeatBookingMode): boolean | null {
  if (mode === "inherit") return null;
  return mode === "yes";
}

/**
 * Coordonnée facultative saisie en texte.
 *
 * `<input type="number">` renvoie `""` quand il est vide et `NaN` quand la
 * saisie est partielle : on garde donc une chaîne, validée ici et convertie au
 * moment de construire le corps de la requête.
 */
function coordinate(bound: number, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => {
      if (value === "") return true;
      const parsed = Number(value);
      return Number.isFinite(parsed) && Math.abs(parsed) <= bound;
    }, message);
}

/**
 * Schéma du formulaire.
 *
 * Entrée et sortie sont du même type : les champs facultatifs acceptent la
 * chaîne vide (ce que produit un `<input>` non renseigné) plutôt que
 * `undefined`. La conversion « vide → champ omis » a lieu dans
 * `toBackendPayload()`.
 */
export const seatFormSchema = z
  .object({
    // Facultatif côté `CreateSeatDto`, exigé ici : une agence sans nom est
    // impossible à désigner dans une liste d'affectation.
    name: z
      .string()
      .trim()
      .min(2, "validation.seatNameRequired")
      .max(100, "validation.max100"),
    // `<select>` ne produit que des chaînes ; la conversion en entier — le
    // backend attend un `@IsInt()` — se fait à l'envoi.
    agencyId: z.string().min(1, "validation.agencyRequired"),
    street: z.string().trim().max(100, "validation.max100"),
    lat: coordinate(90, "validation.latitudeInvalid"),
    long: coordinate(180, "validation.longitudeInvalid"),
    isMain: z.boolean(),
    isActive: z.boolean(),
    hasBedroom: z.boolean(),
    allowSeatNumberBook: z.enum(SEAT_BOOKING_MODES),
  })
  .superRefine((values, ctx) => {
    // Une latitude seule ne localise rien : le couple est indivisible.
    if (Boolean(values.lat) === Boolean(values.long)) return;

    ctx.addIssue({
      code: "custom",
      path: [values.lat ? "long" : "lat"],
      message: "validation.coordinatesIncomplete",
    });
  });

export type SeatFormValues = z.infer<typeof seatFormSchema>;

/** Valeurs initiales d'une création. */
export const EMPTY_SEAT_FORM: SeatFormValues = {
  name: "",
  agencyId: "",
  street: "",
  lat: "",
  long: "",
  isMain: false,
  isActive: true,
  hasBedroom: false,
  allowSeatNumberBook: "inherit",
};

export function toSeatFormValues(seat: SeatSummary | null): SeatFormValues {
  if (!seat) return EMPTY_SEAT_FORM;

  return {
    name: seat.name ?? "",
    agencyId: seat.agency ? String(seat.agency.id) : "",
    street: seat.street ?? "",
    lat: seat.lat === null ? "" : String(seat.lat),
    long: seat.long === null ? "" : String(seat.long),
    isMain: seat.isMain,
    isActive: seat.isActive,
    hasBedroom: seat.hasBedroom,
    allowSeatNumberBook: toBookingMode(seat.allowSeatNumberBook),
  };
}

/** Création : identique au formulaire. */
export const createSeatSchema = seatFormSchema;

/** Édition : mêmes champs, plus l'identifiant de la cible. */
export const updateSeatSchema = seatFormSchema.extend({ id: z.string().min(1) });

export const seatIdSchema = z.object({ id: z.string().min(1) });

export const toggleSeatActiveSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
});

/* -------------------------------------------------------------------------- */
/* Filtres de liste                                                            */
/* -------------------------------------------------------------------------- */

export const SEAT_STATUS = ["all", "active", "inactive"] as const;
export type SeatStatus = (typeof SEAT_STATUS)[number];

export type SeatFilters = { status: SeatStatus };

export const SEAT_FILTER_PARAM = { status: "statut" } as const;

/** Lit les filtres depuis l'URL. Toute valeur inconnue retombe sur « toutes ». */
export function parseSeatFilters(
  params: Record<string, string | string[] | undefined>,
): SeatFilters {
  const raw = params[SEAT_FILTER_PARAM.status];
  const status = Array.isArray(raw) ? raw[0] : raw;

  return {
    status: SEAT_STATUS.includes(status as SeatStatus) ? (status as SeatStatus) : "all",
  };
}

/* -------------------------------------------------------------------------- */
/* Contacts d'agence (SeatContactEntity)                                       */
/* -------------------------------------------------------------------------- */

export const seatContactSchema = z
  .object({
    id: z.string(),
    label: z.string().nullable().optional(),
    phoneNumber: z.string(),
  })
  .loose();

export type SeatContactEntity = z.infer<typeof seatContactSchema>;

export type SeatContact = { id: string; label: string | null; phoneNumber: string };

export function toSeatContact(entity: SeatContactEntity): SeatContact {
  return {
    id: entity.id,
    label: entity.label ?? null,
    phoneNumber: entity.phoneNumber,
  };
}

/**
 * Formulaire d'ajout de contact.
 *
 * Le numéro doit porter son indicatif international : `SeatContactEntity`
 * l'impose comme **unique** en base et le plafonne à 15 caractères. Deux
 * agences ne peuvent donc pas partager un même numéro — c'est le cas d'échec le
 * plus fréquent, et il faut le dire clairement plutôt que de relayer une 400.
 */
export const seatContactFormSchema = z.object({
  seatId: z.string().min(1),
  label: z.string().trim().max(50, "validation.max50"),
  phoneNumber: z
    .string()
    .trim()
    .max(15, "validation.max15")
    .regex(/^\+[1-9]\d{7,14}$/, "validation.phoneInternational"),
});

export type SeatContactFormValues = z.infer<typeof seatContactFormSchema>;

export const seatContactIdSchema = z.object({ id: z.string().min(1) });
