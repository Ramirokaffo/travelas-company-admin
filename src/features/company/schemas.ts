import { z } from "zod";

/**
 * Schémas du domaine « entreprise ».
 *
 * Comme partout, les messages sont des **clés de catalogue** : ce module est
 * importé du navigateur comme du serveur et n'a pas accès à un traducteur.
 */

/**
 * `CreateCompanyDto` ne porte qu'un champ : `name`.
 *
 * Le `ValidationPipe` global du backend est en `forbidNonWhitelisted` — ajouter
 * ici un champ que le DTO ignore (options de réservation, frais…) ferait
 * échouer la création en 400. Ces réglages se modifient après coup, via
 * `PATCH /company/:id` et son `UpdateCompanyDto`.
 */
export const companyFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "validation.companyNameRequired")
    .max(100, "validation.max100"),
});

export type CompanyFormValues = z.infer<typeof companyFormSchema>;

/* -------------------------------------------------------------------------- */
/* Réglages de l'entreprise (PATCH /company/:id)                               */
/* -------------------------------------------------------------------------- */

/**
 * Ce qu'un voyageur peut faire d'un billet (`TicketAllowedAction`).
 *
 * `pay` = paiement immédiat exigé ; `reserve` = réservation sans paiement ;
 * `both` = les deux au choix. Le réglage vaut pour toute l'entreprise ; un
 * trajet peut ensuite le surcharger.
 */
export const TICKET_ACTIONS = ["pay", "reserve", "both"] as const;
export type TicketAction = (typeof TICKET_ACTIONS)[number];

/**
 * Schéma des réglages modifiables par un chef d'entreprise.
 *
 * ⚠️ `requiredFee` et `feePercent` n'y figurent pas : `UpdateCompanyDto` ne les
 * porte pas — ils appartiennent à `AdminUpdateCompanyDto`, réservé au
 * `super_admin`. Les envoyer ferait échouer la requête en 400
 * (`forbidNonWhitelisted`), ce qui est la bonne réponse : le taux de commission
 * de la plateforme n'est pas négociable depuis ce dashboard.
 */
export const companySettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "validation.companyNameRequired")
    .max(100, "validation.max100"),
  allowedAction: z.enum(TICKET_ACTIONS),
  allowSeatNumberBook: z.boolean(),
  allowIssuesReport: z.boolean(),
  is2fAuthEnable: z.boolean(),
});

export type CompanySettingsValues = z.infer<typeof companySettingsSchema>;

/** Vue projetée de l'entreprise transmise au navigateur. */
export type CompanyProfile = {
  id: string;
  name: string | null;
  logo: string | null;
  bannerImage: string | null;
  isActive: boolean;
  /** Note moyenne laissée par les voyageurs, sur 5. */
  ratingAverage: number;
  ratingCount: number;
  allowedAction: TicketAction;
  allowSeatNumberBook: boolean;
  allowIssuesReport: boolean;
  is2fAuthEnable: boolean;
  /** Lecture seule : réglés par la plateforme, pas par l'entreprise. */
  requiredFee: boolean;
  feePercent: number;
};

export function toCompanyProfile(entity: {
  id: string;
  name?: string | null;
  logo?: string | null;
  bannerImage?: string | null;
  isActive?: boolean;
  ratingAverage?: number;
  ratingCount?: number;
  allowedAction?: string;
  allowSeatNumberBook?: boolean;
  allowIssuesReport?: boolean;
  is2fAuthEnable?: boolean;
  requiredFee?: boolean;
  feePercent?: number;
}): CompanyProfile {
  const action = entity.allowedAction;

  return {
    id: entity.id,
    name: entity.name ?? null,
    logo: entity.logo ?? null,
    bannerImage: entity.bannerImage ?? null,
    isActive: entity.isActive ?? false,
    ratingAverage: entity.ratingAverage ?? 0,
    ratingCount: entity.ratingCount ?? 0,
    allowedAction: TICKET_ACTIONS.includes(action as TicketAction)
      ? (action as TicketAction)
      : "pay",
    allowSeatNumberBook: entity.allowSeatNumberBook ?? false,
    allowIssuesReport: entity.allowIssuesReport ?? false,
    is2fAuthEnable: entity.is2fAuthEnable ?? false,
    requiredFee: entity.requiredFee ?? false,
    feePercent: entity.feePercent ?? 0,
  };
}

export function toCompanySettingsValues(
  company: CompanyProfile,
): CompanySettingsValues {
  return {
    name: company.name ?? "",
    allowedAction: company.allowedAction,
    allowSeatNumberBook: company.allowSeatNumberBook,
    allowIssuesReport: company.allowIssuesReport,
    is2fAuthEnable: company.is2fAuthEnable,
  };
}

/** Plafond appliqué par `MyFileSizeValidator` côté backend (2 Mo). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Types acceptés par `MyFileTypeValidator` (`image/(jpeg|jpg|ico|png|webp)`). */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
] as const;

export const ACCEPTED_IMAGE_ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",");

/**
 * Contrôle du seul type, à la sélection.
 *
 * La taille n'a pas encore de sens à ce stade : le fichier choisi est
 * l'original, alors que le formulaire postera son recadrage — réencodé et
 * borné en largeur, donc presque toujours plus léger. Refuser ici une photo de
 * 6 Mo qui ressortira à 300 Ko serait un faux négatif.
 */
export function isAcceptedImageType(file: File): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

export type ImageCheck =
  { ok: true; file: File | null } | { ok: false; message: string };

/**
 * Valide une image reçue d'un `FormData`.
 *
 * Les mêmes règles que le backend, vérifiées avant l'envoi : un fichier trop
 * lourd refusé après un téléversement complet est une mauvaise expérience, et
 * un message générique de 400 n'expliquerait pas la cause.
 *
 * Un champ vide arrive sous la forme d'un `File` de taille nulle : c'est une
 * absence de fichier, pas une erreur.
 */
export function checkCompanyImage(value: unknown): ImageCheck {
  if (!(value instanceof File) || value.size === 0) return { ok: true, file: null };

  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(value.type)) {
    return { ok: false, message: "onboarding.actions.imageType" };
  }

  if (value.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "onboarding.actions.imageTooLarge" };
  }

  return { ok: true, file: value };
}
