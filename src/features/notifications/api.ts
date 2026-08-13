import "server-only";

import { z } from "zod";

import { paginatedSchema, type TableQuery } from "@/lib/api/data-table";
import { apiFetch } from "@/lib/api/server-api";

import {
  toNotification,
  unreadCountSchema,
  userNotificationEntitySchema,
  type Notification,
  type NotificationFilters,
} from "./schemas";

/**
 * Accès backend du domaine « notifications » — SERVEUR UNIQUEMENT.
 *
 * `GET /user-notification/getMine` est cadré par le backend sur le porteur du
 * token : aucun identifiant de compte ne circule, il n'y a donc rien à
 * cloisonner ici.
 *
 * `withCount` est **opt-in** côté backend, pour ne pas casser l'application
 * mobile qui lit un tableau nu. On le demande systématiquement depuis ce
 * dashboard : sans total, la pagination ne saurait pas afficher le dernier
 * numéro de page.
 *
 * `UserNotificationFilterDto` n'expose ni `orderBy` ni `order` — le service
 * trie toujours par date décroissante. Le tri n'est donc pas proposé, et
 * `parseTableQuery` est appelé sans `sortableColumns` : transmettre `orderBy`
 * ferait échouer la requête en 400 (`forbidNonWhitelisted`).
 */

const notificationListSchema = paginatedSchema(userNotificationEntitySchema);

export type NotificationPage = { items: Notification[]; total: number | null };

export async function listMyNotifications(
  query: TableQuery,
  filters: NotificationFilters,
  accessToken: string,
  locale: string,
): Promise<NotificationPage> {
  const result = await apiFetch("/user-notification/getMine", notificationListSchema, {
    accessToken,
    query: {
      page: query.page - 1,
      count: query.perPage,
      withCount: true,
      ...(filters.status === "unread" ? { onlyUnread: true } : {}),
      ...(filters.type !== "all" ? { type: filters.type } : {}),
      ...(query.search ? { search: query.search } : {}),
    },
  });

  return {
    items: result.items.map((entity) => toNotification(entity, locale)),
    total: result.total,
  };
}

/**
 * Les quelques dernières notifications, pour le panneau de la cloche.
 *
 * Volontairement séparé de `listMyNotifications` : le panneau n'a pas de
 * pagination et n'a donc aucune raison de demander un total au backend.
 */
export async function listRecentNotifications(
  accessToken: string,
  locale: string,
  limit = 6,
): Promise<Notification[]> {
  const result = await apiFetch("/user-notification/getMine", notificationListSchema, {
    accessToken,
    query: { page: 0, count: limit },
  });

  return result.items.map((entity) => toNotification(entity, locale));
}

/** Nombre de non-lues, pour la pastille de la cloche. */
export async function countUnreadNotifications(accessToken: string): Promise<number> {
  const result = await apiFetch(
    "/user-notification/unreadCount",
    unreadCountSchema,
    { accessToken },
  );
  return result.count;
}

/** Marque une notification comme lue. Le backend vérifie qu'elle nous appartient. */
export async function markNotificationRead(
  id: string,
  accessToken: string,
): Promise<void> {
  await apiFetch(
    `/user-notification/${encodeURIComponent(id)}`,
    z.unknown(),
    { method: "PATCH", accessToken, body: { isOpen: true } },
  );
}

/** Marque toute la boîte comme lue. */
export async function markAllNotificationsRead(accessToken: string): Promise<number> {
  const result = await apiFetch(
    "/user-notification/readAll",
    z.object({ updated: z.coerce.number().int().nonnegative().catch(0) }).loose(),
    { method: "PATCH", accessToken },
  );
  return result.updated;
}

/** Retire une notification de la boîte. */
export async function deleteNotification(
  id: string,
  accessToken: string,
): Promise<void> {
  await apiFetch(
    `/user-notification/${encodeURIComponent(id)}`,
    z.unknown(),
    { method: "DELETE", accessToken },
  );
}

/**
 * Obtient un ticket d'ouverture de socket.
 *
 * Le JWT reste dans son cookie `httpOnly` : c'est ce ticket — opaque, à usage
 * unique, valable 60 s — qui descend jusqu'au navigateur.
 */
export async function issueSocketTicket(
  accessToken: string,
): Promise<{ ticket: string; expiresIn: number }> {
  return await apiFetch(
    "/socket/ticket",
    z.object({ ticket: z.string(), expiresIn: z.coerce.number().int().positive() }).loose(),
    { method: "POST", accessToken },
  );
}
