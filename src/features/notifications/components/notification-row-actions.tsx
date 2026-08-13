"use client";

import { Check, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslatedMessage } from "@/lib/i18n/message";
import { cn } from "@/lib/utils/cn";

import { deleteNotificationAction, markNotificationReadAction } from "../actions";
import type { Notification } from "../schemas";

/**
 * Actions d'une ligne du centre de notification.
 *
 * `router.refresh()` en plus du `revalidatePath` de l'action : le compteur de
 * la cloche est rendu par le **layout**, que `revalidatePath` sur la seule page
 * `/notifications` ne rejoue pas. Sans ce rafraîchissement, marquer lu
 * laisserait la pastille inchangée jusqu'à la navigation suivante.
 */
export function NotificationRowActions({ notification }: { notification: Notification }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const message = useTranslatedMessage();
  const [isPending, startTransition] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const iconButton = cn(
    "text-muted hover:bg-subtle hover:text-foreground rounded-lg p-1.5",
    "focus-visible:outline-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2",
    "disabled:opacity-60",
  );

  const handleMarkRead = () => {
    startTransition(async () => {
      const result = await markNotificationReadAction({ id: notification.id });
      if (!result.ok) {
        toast.error(message(result.message));
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = async () => {
    const result = await deleteNotificationAction({ id: notification.id });
    if (!result.ok) {
      // Levée pour que `ConfirmDialog` reste ouvert et affiche l'erreur.
      throw new Error(message(result.message));
    }
    toast.success(message(result.message));
    router.refresh();
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      {!notification.isRead ? (
        <button
          type="button"
          onClick={handleMarkRead}
          disabled={isPending}
          aria-label={t("rowActions.markRead", { title: notification.title })}
          title={t("markRead")}
          className={iconButton}
        >
          <Check className="size-4" aria-hidden />
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setIsConfirmOpen(true)}
        disabled={isPending}
        aria-label={t("rowActions.delete", { title: notification.title })}
        title={t("delete")}
        className={iconButton}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={t("confirmDelete.title")}
        description={t("confirmDelete.description", { title: notification.title })}
        confirmLabel={t("confirmDelete.action")}
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}
