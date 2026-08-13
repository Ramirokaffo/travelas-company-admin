import { z } from "zod";

/**
 * Schémas du domaine « notifications ».
 *
 * Deux entités backend se superposent, et la distinction porte tout le reste :
 *
 *  - `NotificationEntity` est la **diffusion** : un contenu, rédigé une fois.
 *  - `UserNotificationEntity` est sa **distribution** : une ligne par
 *    destinataire, qui porte `isOpen`.
 *
 * L'identifiant manipulé ici est donc toujours celui de la *distribution* —
 * c'est lui que `PATCH /user-notification/:id` attend. Marquer lu avec
 * l'identifiant de la diffusion produirait un 404.
 *
 * Le contenu est bilingue en base (`title` / `title_en`) : ce ne sont pas des
 * clés de catalogue mais du texte rédigé par le super-administrateur, choisi à
 * l'affichage selon la langue de la requête.
 */

/** Valeurs de `NotificationTypeEnum` côté backend. */
export const NOTIFICATION_TYPES = ["notification", "wallet", "ticket", "referral"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const notificationContentSchema = z
  .object({
    id: z.string(),
    type: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    title_en: z.string().nullable().optional(),
    subtitle: z.string().nullable().optional(),
    subtitle_en: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    description_en: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    image_en: z.string().nullable().optional(),
    createAt: z.union([z.string(), z.date()]).nullable().optional(),
  })
  .loose();

export const userNotificationEntitySchema = z
  .object({
    id: z.string(),
    isOpen: z.union([z.boolean(), z.number()]).nullable().optional(),
    createAt: z.union([z.string(), z.date()]).nullable().optional(),
    notification: notificationContentSchema.nullable().optional(),
  })
  .loose();

export type UserNotificationEntity = z.infer<typeof userNotificationEntitySchema>;

/** Réponse de `GET /user-notification/unreadCount`. */
export const unreadCountSchema = z
  .object({ count: z.coerce.number().int().nonnegative().catch(0) })
  .loose();

/** Vue projetée transmise au navigateur. */
export type Notification = {
  /** Identifiant de la **distribution** — celui que le marquage lu attend. */
  id: string;
  isRead: boolean;
  createdAt: string | null;
  type: NotificationType;
  title: string;
  subtitle: string | null;
  description: string | null;
  image: string | null;
};

function toIsoString(value: string | Date | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value ? value : null;
}

/** Choisit la variante linguistique, avec repli sur le français rédigé d'abord. */
function pick(
  fr: string | null | undefined,
  en: string | null | undefined,
  locale: string,
): string | null {
  const preferred = locale === "en" ? en : fr;
  return preferred?.trim() || fr?.trim() || en?.trim() || null;
}

function toType(value: string | null | undefined): NotificationType {
  return NOTIFICATION_TYPES.includes(value as NotificationType)
    ? (value as NotificationType)
    : "notification";
}

export function toNotification(
  entity: UserNotificationEntity,
  locale: string,
): Notification {
  const content = entity.notification;

  return {
    id: entity.id,
    // `isOpen` remonte parfois en 0/1 : MySQL stocke le booléen en TINYINT et
    // le pilote ne le reconvertit pas toujours.
    isRead: Boolean(entity.isOpen),
    createdAt: toIsoString(entity.createAt) ?? toIsoString(content?.createAt),
    type: toType(content?.type),
    title: pick(content?.title, content?.title_en, locale) ?? "",
    subtitle: pick(content?.subtitle, content?.subtitle_en, locale),
    description: pick(content?.description, content?.description_en, locale),
    image: pick(content?.image, content?.image_en, locale),
  };
}

/* -------------------------------------------------------------------------- */
/* Filtres de liste                                                            */
/* -------------------------------------------------------------------------- */

export const NOTIFICATION_STATUSES = ["all", "unread"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export type NotificationFilters = {
  status: NotificationStatus;
  type: NotificationType | "all";
};

export const NOTIFICATION_FILTER_PARAM = { status: "statut", type: "type" } as const;

export function parseNotificationFilters(
  params: Record<string, string | string[] | undefined>,
): NotificationFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const status = first(params[NOTIFICATION_FILTER_PARAM.status]);
  const type = first(params[NOTIFICATION_FILTER_PARAM.type]);

  return {
    status: NOTIFICATION_STATUSES.includes(status as NotificationStatus)
      ? (status as NotificationStatus)
      : "all",
    type: NOTIFICATION_TYPES.includes(type as NotificationType)
      ? (type as NotificationType)
      : "all",
  };
}

/* -------------------------------------------------------------------------- */
/* Entrées des Server Actions                                                  */
/* -------------------------------------------------------------------------- */

export const notificationIdSchema = z.object({
  id: z.string().min(1, "notifications.actions.invalidRequest"),
});
