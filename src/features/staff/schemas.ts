import { z } from "zod";

import { UserRole } from "@/constants/roles";
import { userSchema } from "@/types/user";

/**
 * Schémas du domaine « personnel ».
 *
 * Module volontairement pur (pas de `server-only`) : les mêmes schémas servent
 * au formulaire dans le navigateur et à la revalidation dans la Server Action.
 * La validation client est un confort, celle du serveur est la garantie.
 *
 * Pour la même raison, les messages sont des **clés de catalogue** et non du
 * texte : un module partagé ne peut pas accéder à un traducteur lié à la
 * requête. La traduction a lieu à l'affichage (`lib/i18n/message.ts`).
 */

/* -------------------------------------------------------------------------- */
/* Formulaires                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Rôles qu'un chef d'entreprise peut attribuer.
 *
 * Miroir de `CREATABLE_ROLES[COMPANY_ADMIN]` dans
 * `src/helpers/company-scope.helper.ts` côté backend. Le backend refuse de
 * toute façon les autres (403) : cette liste sert l'ergonomie, pas la sécurité.
 */
export const STAFF_ROLES = [
  UserRole.AGENCY_ADMIN,
  UserRole.COMPANY_AGENT,
  UserRole.COMPANY_DRIVER,
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

/**
 * Schéma du formulaire.
 *
 * Entrée et sortie sont volontairement du même type : les champs facultatifs
 * acceptent la chaîne vide (ce que produit un `<select>` ou un `<input>` non
 * renseigné) plutôt que `undefined`. Un schéma qui transforme ses valeurs
 * obligerait `react-hook-form` à jongler entre deux types de formulaire pour
 * aucun gain — la conversion « vide → champ omis » se fait au moment de
 * construire le corps de la requête (`toBackendPayload`).
 */
export const staffFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "validation.firstNameRequired")
    .max(50, "validation.max50"),
  lastName: z
    .string()
    .trim()
    .min(2, "validation.lastNameRequired")
    .max(50, "validation.max50"),
  email: z.email("validation.emailInvalid").max(50, "validation.max50"),
  // Le backend valide avec `@IsPhoneNumber()` sans région : sans indicatif,
  // la requête part et revient en 400. On l'exige donc dès le formulaire.
  phoneNumber: z
    .string()
    .trim()
    .max(15, "validation.max15")
    .regex(/^\+[1-9]\d{7,14}$/, "validation.phoneInternational"),
  role: z.enum(STAFF_ROLES, { error: "validation.roleRequired" }),
  seatId: z.string(),
  cniNumber: z.string().trim().max(20, "validation.max20"),
  lang: z.enum(["fr", "en"]),
});

export type StaffFormValues = z.infer<typeof staffFormSchema>;

/** Valeurs initiales d'une création. */
export const EMPTY_STAFF_FORM: StaffFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  role: UserRole.COMPANY_AGENT,
  seatId: "",
  cniNumber: "",
  lang: "fr",
};

/** Création : identique au formulaire. Le mot de passe est généré et envoyé par le backend. */
export const createStaffSchema = staffFormSchema;

/** Édition : mêmes champs, plus l'identifiant de la cible. */
export const updateStaffSchema = staffFormSchema.extend({
  id: z.string().min(1),
});

export const staffIdSchema = z.object({ id: z.string().min(1) });

export const toggleStaffBlockSchema = z.object({
  id: z.string().min(1),
  isBlocked: z.boolean(),
});

/* -------------------------------------------------------------------------- */
/* Filtres de liste                                                            */
/* -------------------------------------------------------------------------- */

export const STAFF_STATUS = ["all", "active", "blocked"] as const;
export type StaffStatus = (typeof STAFF_STATUS)[number];

export type StaffFilters = {
  role: StaffRole | null;
  status: StaffStatus;
};

export const STAFF_FILTER_PARAM = { role: "role", status: "statut" } as const;

/** Lit les filtres depuis l'URL. Toute valeur inconnue retombe sur « tous ». */
export function parseStaffFilters(
  params: Record<string, string | string[] | undefined>,
): StaffFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const role = first(params[STAFF_FILTER_PARAM.role]);
  const status = first(params[STAFF_FILTER_PARAM.status]);

  return {
    role: STAFF_ROLES.includes(role as StaffRole) ? (role as StaffRole) : null,
    status: STAFF_STATUS.includes(status as StaffStatus)
      ? (status as StaffStatus)
      : "all",
  };
}

/* -------------------------------------------------------------------------- */
/* Réponses backend                                                            */
/* -------------------------------------------------------------------------- */

export const userPermissionSchema = z
  .object({
    id: z.number().optional(),
    isActive: z.boolean().optional(),
    canCutTicket: z.boolean().optional(),
    canCreateRide: z.boolean().optional(),
    canUpdateRide: z.boolean().optional(),
    canCreateUser: z.boolean().optional(),
    canUpdateUser: z.boolean().optional(),
    canDeleteUser: z.boolean().optional(),
    canWithdrawFromSeatWallet: z.boolean().optional(),
  })
  .loose();

/** L'entité renvoyée par `/user/getMyCompanyUsers`, `POST /user/create`, `PATCH /user/:id`. */
export const staffMemberSchema = userSchema
  .extend({
    permission: userPermissionSchema.nullable().optional(),
    createAt: z.union([z.string(), z.date()]).nullable().optional(),
  })
  .loose();

export type StaffMemberEntity = z.infer<typeof staffMemberSchema>;

/** Réponse de `POST /user/create` et `PATCH /user/:id`. */
export const staffMutationResponseSchema = z
  .object({ user: staffMemberSchema.optional(), status: z.string().optional() })
  .loose();

/**
 * Vue projetée transmise au navigateur.
 *
 * L'entité backend porte `password`, `salt`, `firebaseId`, `notificationId`,
 * `walletAmount`… Rien de tout cela ne doit franchir la frontière serveur, même
 * si le backend a cessé de renvoyer le hash (cf. `UserService.withoutSecrets`).
 */
export type StaffMember = {
  id: string;
  userName: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  role: UserRole;
  isActive: boolean;
  isBlocked: boolean;
  isEmailVerify: boolean;
  cniNumber: string | null;
  lang: "fr" | "en";
  /** Agence de rattachement (`SeatEntity`), `null` si le compte n'est affecté nulle part. */
  seat: { id: string; name: string | null } | null;
  createdAt: string | null;
};

export function toStaffMember(entity: StaffMemberEntity): StaffMember {
  const cniNumber = entity.cniNumber;
  const createdAt = entity.createAt;

  return {
    id: entity.id,
    userName: entity.userName,
    firstName: entity.firstName,
    lastName: entity.lastName ?? null,
    fullName: [entity.firstName, entity.lastName].filter(Boolean).join(" "),
    email: entity.email ?? null,
    phoneNumber: entity.phoneNumber ?? null,
    role: entity.role,
    isActive: entity.isActive ?? false,
    isBlocked: entity.isBlocked ?? false,
    isEmailVerify: entity.isEmailVerify ?? false,
    cniNumber: typeof cniNumber === "string" ? cniNumber : null,
    lang: entity.lang === "en" ? "en" : "fr",
    seat: entity.companySeat
      ? { id: entity.companySeat.id, name: entity.companySeat.name ?? null }
      : null,
    createdAt:
      createdAt instanceof Date
        ? createdAt.toISOString()
        : typeof createdAt === "string"
          ? createdAt
          : null,
  };
}
