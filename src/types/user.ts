import { z } from "zod";

import { UserRole } from "@/constants/roles";

/**
 * Schémas des entités backend.
 *
 * On valide les réponses de l'API au lieu de les caster : le backend renvoie
 * parfois l'entité TypeORM complète (relations incluses), et un `as User`
 * masquerait des champs absents. `.loose()` conserve les champs supplémentaires
 * sans les typer.
 */

export const companySchema = z
  .object({
    id: z.string(),
    name: z.string().nullable().optional(),
    logo: z.string().nullable().optional(),
    bannerImage: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    ratingAverage: z.number().optional(),
    ratingCount: z.number().optional(),
    allowSeatNumberBook: z.boolean().optional(),
    allowIssuesReport: z.boolean().optional(),
    is2fAuthEnable: z.boolean().optional(),
    requiredFee: z.boolean().optional(),
    feePercent: z.number().optional(),
    allowedAction: z.string().optional(),
  })
  .loose();

export type Company = z.infer<typeof companySchema>;

/** Un « siège » (`SeatEntity`) est une agence physique de l'entreprise. */
export const seatSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable().optional(),
    isMain: z.boolean().optional(),
    isActive: z.boolean().optional(),
    street: z.string().nullable().optional(),
    lat: z.number().nullable().optional(),
    long: z.number().nullable().optional(),
    hasBedroom: z.boolean().optional(),
    walletAmount: z.number().optional(),
    allowSeatNumberBook: z.boolean().nullable().optional(),
  })
  .loose();

export type Seat = z.infer<typeof seatSchema>;

export const userSchema = z
  .object({
    id: z.string(),
    userName: z.string(),
    email: z.string().nullable().optional(),
    /**
     * Adresse demandée mais pas encore prouvée par un code.
     * Reste `null` hors changement d'adresse en cours.
     */
    pendingEmail: z.string().nullable().optional(),
    firstName: z.string(),
    lastName: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
    role: z.enum([
      UserRole.SUPER_ADMIN,
      UserRole.COMPANY_ADMIN,
      UserRole.COMPANY_DRIVER,
      UserRole.COMPANY_AGENT,
      UserRole.AGENCY_ADMIN,
      UserRole.USER,
    ]),
    profilImage: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    isBlocked: z.boolean().optional(),
    isEmailVerify: z.boolean().optional(),
    isPhoneVerify: z.boolean().optional(),
    is2fAuthEnable: z.boolean().optional(),
    needPasswordUpdate: z.boolean().optional(),
    lang: z.string().optional(),
    company: companySchema.nullable().optional(),
    companySeat: seatSchema.nullable().optional(),
  })
  .loose();

export type User = z.infer<typeof userSchema>;

/**
 * Vue projetée de l'utilisateur transmise au navigateur.
 *
 * On ne renvoie JAMAIS l'entité brute au client : elle contient `password`,
 * `salt`, `firebaseId`, `notificationId`, etc.
 */
export type SessionUser = {
  id: string;
  userName: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  /** Adresse en attente de vérification, `null` hors changement en cours. */
  pendingEmail: string | null;
  /** `false` tant que l'adresse n'a pas été prouvée par un code. */
  isEmailVerify: boolean;
  phoneNumber: string | null;
  role: UserRole;
  profilImage: string | null;
  /** Langue enregistrée sur le compte — sert aux e-mails et notifications. */
  lang: string | null;
  is2fAuthEnable: boolean;
  /** Entreprise du chef d'entreprise. `null` tant que l'onboarding n'est pas fait. */
  company: {
    id: string;
    name: string | null;
    logo: string | null;
    isActive: boolean;
  } | null;
  /** Agence de rattachement, si le chef d'entreprise est associé à un siège précis. */
  seat: { id: string; name: string | null; isMain: boolean } | null;
};

/** Projette l'entité backend vers la vue exposée au navigateur. */
export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    userName: user.userName,
    firstName: user.firstName,
    lastName: user.lastName ?? null,
    email: user.email ?? null,
    pendingEmail: user.pendingEmail ?? null,
    isEmailVerify: user.isEmailVerify ?? false,
    phoneNumber: user.phoneNumber ?? null,
    role: user.role,
    profilImage: user.profilImage ?? null,
    lang: user.lang ?? null,
    is2fAuthEnable: user.is2fAuthEnable ?? false,
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name ?? null,
          logo: user.company.logo ?? null,
          isActive: user.company.isActive ?? false,
        }
      : null,
    seat: user.companySeat
      ? {
          id: user.companySeat.id,
          name: user.companySeat.name ?? null,
          isMain: user.companySeat.isMain ?? false,
        }
      : null,
  };
}
