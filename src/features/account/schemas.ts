import { z } from "zod";

import { strongPasswordSchema } from "@/features/auth/schemas";
import { LOCALES } from "@/i18n/config";

/**
 * Schémas du domaine « compte » — les réglages personnels du chef d'entreprise.
 *
 * Module volontairement pur (pas de `server-only`) : les mêmes schémas servent
 * au formulaire dans le navigateur et à la revalidation dans les Server
 * Actions. La validation client est un confort, celle du serveur est la
 * garantie.
 *
 * Comme partout, les messages sont des **clés de catalogue** : un module qui
 * traverse la frontière client/serveur n'a pas accès à un traducteur lié à la
 * requête (voir `lib/i18n/message.ts`).
 */

/* -------------------------------------------------------------------------- */
/* Identité                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Champs d'identité modifiables par leur titulaire (`PATCH /user`).
 *
 * ⚠️ Ni `email` ni `role` ni `seatId` n'y figurent, et ce n'est pas un oubli :
 *  - l'adresse e-mail relève du parcours vérifié ci-dessous — le backend refuse
 *    désormais de la changer par cette route ;
 *  - `role`, `isBlocked`, `isActive`, `seatId` et `permission` appartiennent aux
 *    `SELF_PROTECTED_FIELDS` du backend : les envoyer sur son propre compte
 *    produit une 400, ce qui est exactement le comportement voulu — personne ne
 *    se promeut soi-même.
 */
export const profileFormSchema = z.object({
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
  userName: z
    .string()
    .trim()
    .min(3, "validation.usernameMin3")
    .max(30, "validation.max30")
    .regex(/^[a-zA-Z0-9._-]+$/, "validation.usernameCharset"),
  /**
   * `@IsPhoneNumber()` est utilisé **sans région** côté backend : l'indicatif
   * international est obligatoire, sinon la requête revient en 400 sans message
   * exploitable.
   */
  phoneNumber: z
    .string()
    .trim()
    .max(15, "validation.max15")
    .regex(/^\+[1-9]\d{7,13}$/, "validation.phoneInternational"),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

/* -------------------------------------------------------------------------- */
/* Mot de passe                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Changement de mot de passe depuis un compte connecté
 * (`POST /auth/changePassword`).
 *
 * Le mot de passe actuel est exigé par le backend, et c'est bien : une session
 * laissée ouverte ne doit pas suffire à verrouiller le compte de son titulaire.
 * Le nouveau passe par `strongPasswordSchema`, le même que l'inscription — le
 * backend, lui, se contente de six caractères (`ChangePasswordDto`).
 */
export const changePasswordFormSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "validation.passwordRequired")
      .max(128, "validation.passwordTooLong"),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, "validation.confirmPasswordRequired"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    // Le backend refuse déjà un mot de passe identique au précédent ; le dire
    // ici évite un aller-retour pour une erreur évidente.
    message: "validation.passwordSameAsCurrent",
    path: ["newPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;

/* -------------------------------------------------------------------------- */
/* Adresse e-mail                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Demande de changement d'adresse (`POST /auth/requestEmailChange`).
 *
 * Le mot de passe accompagne la nouvelle adresse : l'e-mail est la clé de
 * récupération du compte, le déplacer depuis un poste laissé ouvert reviendrait
 * à offrir le compte.
 */
export const emailChangeFormSchema = z.object({
  newEmail: z.email("validation.emailInvalid").max(50, "validation.max50"),
  currentPassword: z
    .string()
    .min(1, "validation.passwordRequired")
    .max(128, "validation.passwordTooLong"),
});

export type EmailChangeFormValues = z.infer<typeof emailChangeFormSchema>;

/**
 * Code à six chiffres reçu sur la nouvelle adresse, valable cinq minutes.
 *
 * Exactement six, contrairement à `emailCodeSchema` qui tolère 4 à 8 : ce
 * parcours-ci a un DTO côté backend (`ConfirmEmailChangeDto`, `@Matches(/^\d{6}$/)`),
 * et une longueur admise ici mais refusée là-bas ne produirait qu'un message
 * d'erreur backend non traduisible.
 */
export const emailChangeCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "validation.codeInvalid"),
});

export type EmailChangeCodeValues = z.infer<typeof emailChangeCodeSchema>;

/* -------------------------------------------------------------------------- */
/* Préférences                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Langue enregistrée **sur le compte** (`UserLangEnum` côté backend).
 *
 * À ne pas confondre avec le cookie `travelas_locale`, qui pilote la langue de
 * ce dashboard : celui-ci est propre au navigateur, celle-là suit le compte et
 * sert aux e-mails et aux notifications poussées, y compris hors de ce
 * dashboard. Les deux sont réglées d'un même geste par la carte
 * « Préférences ».
 */
export const accountLangSchema = z.object({
  lang: z.enum(LOCALES),
});

export type AccountLangValues = z.infer<typeof accountLangSchema>;

/* -------------------------------------------------------------------------- */
/* Photo de profil                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Types acceptés par `POST /auth/profile/image`.
 *
 * ⚠️ Plus restrictif que les images d'entreprise : le `FileTypeValidator` de
 * cette route est `/^image\/(jpeg|jpg|ico|png)$/i` — **pas de WebP**. Le
 * recadrage doit donc produire du JPEG ou du PNG (voir `allowWebp` sur
 * `<ImageCropper>`), sinon le téléversement revient en 400.
 */
export const ACCEPTED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/x-icon",
  "image/vnd.microsoft.icon",
] as const;

export const ACCEPTED_AVATAR_ACCEPT_ATTRIBUTE = ACCEPTED_AVATAR_TYPES.join(",");

/** Plafond de la route (`MaxFileSizeValidator`, 3 Mo). On garde une marge. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export type AvatarCheck =
  | { ok: true; file: File | null }
  | { ok: false; message: string };

/**
 * Valide une photo reçue d'un `FormData`, avec les règles du backend.
 *
 * Un champ vide arrive sous la forme d'un `File` de taille nulle : c'est une
 * absence de fichier, pas une erreur.
 */
export function checkAvatarImage(value: unknown): AvatarCheck {
  if (!(value instanceof File) || value.size === 0) return { ok: true, file: null };

  if (!(ACCEPTED_AVATAR_TYPES as readonly string[]).includes(value.type)) {
    return { ok: false, message: "settings.actions.imageType" };
  }

  if (value.size > MAX_AVATAR_BYTES) {
    return { ok: false, message: "settings.actions.imageTooLarge" };
  }

  return { ok: true, file: value };
}

/** Vrai si le type est acceptable à la sélection, avant recadrage. */
export function isAcceptedAvatarType(file: File): boolean {
  return (ACCEPTED_AVATAR_TYPES as readonly string[]).includes(file.type);
}
