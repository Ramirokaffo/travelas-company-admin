"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { ApiError, toUserMessage } from "@/lib/api/errors";
import { getAuthorizedToken, requireSession } from "@/lib/auth/session";

import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "./api";
import { notificationIdSchema } from "./schemas";

/**
 * Server Actions du domaine « notifications ».
 *
 * `requireSession()` — et non `requireCompanySession()` : un compte dont
 * l'onboarding n'est pas terminé reçoit malgré tout des notifications, et doit
 * pouvoir les lire. L'exiger renverrait vers l'onboarding en boucle depuis la
 * cloche, présente sur toutes les pages du dashboard.
 *
 * Le contrôle de propriété est backend (`UserNotificationService`) : marquer lue
 * la notification d'un autre compte y répond 403, quoi qu'on envoie d'ici.
 */

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/** Traduit une erreur backend en résultat affichable. */
async function toActionError(error: unknown): Promise<ActionResult> {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return { ok: false, message: "notifications.actions.forbidden" };
    }
    if (error.isNotFound) {
      return { ok: false, message: "notifications.actions.notFound" };
    }
    return { ok: false, message: toUserMessage(error, await getTranslations()) };
  }

  return { ok: false, message: "errors.unexpected" };
}

export async function markNotificationReadAction(input: unknown): Promise<ActionResult> {
  await requireSession();

  const parsed = notificationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "notifications.actions.invalidRequest" };
  }

  try {
    const token = await getAuthorizedToken();
    await markNotificationRead(parsed.data.id, token);
  } catch (error) {
    return await toActionError(error);
  }

  revalidatePath(ROUTES.notifications);
  return { ok: true, message: "notifications.actions.marked" };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  await requireSession();

  try {
    const token = await getAuthorizedToken();
    await markAllNotificationsRead(token);
  } catch (error) {
    return await toActionError(error);
  }

  revalidatePath(ROUTES.notifications);
  return { ok: true, message: "notifications.actions.allMarked" };
}

export async function deleteNotificationAction(input: unknown): Promise<ActionResult> {
  await requireSession();

  const parsed = notificationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "notifications.actions.invalidRequest" };
  }

  try {
    const token = await getAuthorizedToken();
    await deleteNotification(parsed.data.id, token);
  } catch (error) {
    return await toActionError(error);
  }

  revalidatePath(ROUTES.notifications);
  return { ok: true, message: "notifications.actions.deleted" };
}
