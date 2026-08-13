"use client";

import { CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTranslatedMessage } from "@/lib/i18n/message";

import { markAllNotificationsReadAction } from "../actions";

/**
 * « Tout marquer comme lu ».
 *
 * Masqué quand la boîte est déjà entièrement lue : un bouton qui ne peut rien
 * faire ne mérite pas la place, et son état désactivé n'apprendrait rien.
 */
export function MarkAllReadButton({ unreadCount }: { unreadCount: number }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const message = useTranslatedMessage();
  const [isPending, startTransition] = useTransition();

  if (unreadCount === 0) return null;

  const handleClick = () => {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) {
        toast.error(message(result.message));
        return;
      }
      toast.success(message(result.message));
      // Le compteur de la cloche vit dans le layout, hors du `revalidatePath`
      // de l'action.
      router.refresh();
    });
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={isPending}>
      <CheckCheck className="size-4" aria-hidden />
      {t("markAllRead")}
    </Button>
  );
}
