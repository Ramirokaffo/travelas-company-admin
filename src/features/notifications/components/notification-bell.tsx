"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ROUTES } from "@/constants/routes";
import { useTranslatedMessage } from "@/lib/i18n/message";
import { cn } from "@/lib/utils/cn";

import { markAllNotificationsReadAction } from "../actions";
import { useNotificationSocket } from "../hooks/use-notification-socket";
import type { Notification } from "../schemas";

/** Au-delà, la pastille affiche « 9+ » plutôt qu'un nombre qui déforme la cloche. */
const BADGE_MAX = 9;

type SummaryResponse = { items: Notification[]; unreadCount: number };

/**
 * Cloche du centre de notification.
 *
 * Le compteur initial vient du **rendu serveur** (`(dashboard)/layout.tsx`) :
 * la pastille est donc juste dès le premier octet de HTML, sans attendre un
 * aller-retour client. Le socket ne fait que la maintenir à jour ensuite.
 *
 * Le panneau, lui, ne charge son contenu qu'à l'ouverture : rendre les six
 * dernières notifications sur chaque page du dashboard coûterait une requête
 * backend par navigation, pour un panneau que l'on n'ouvre presque jamais.
 */
export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const router = useRouter();
  const message = useTranslatedMessage();
  const panelId = useId();

  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);

  // Le serveur reste la source de vérité : une navigation qui recalcule le
  // layout doit pouvoir corriger un compteur que le socket aurait décalé.
  //
  // Ajustement pendant le rendu plutôt que dans un effet : c'est le motif
  // recommandé par React pour recaler un état sur une prop. Passer par un effet
  // afficherait d'abord l'ancienne valeur, puis la corrigerait dans un second
  // rendu — soit une pastille qui clignote à chaque navigation.
  const [serverCount, setServerCount] = useState(initialUnreadCount);
  if (serverCount !== initialUnreadCount) {
    setServerCount(initialUnreadCount);
    setUnreadCount(initialUnreadCount);
  }

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/notifications/summary");
      if (!response.ok) return;
      const summary = (await response.json()) as SummaryResponse;
      setItems(summary.items);
      setUnreadCount(summary.unreadCount);
    } catch {
      // Panneau muet plutôt que message d'erreur : la cloche est un accessoire,
      // la page complète reste accessible par le lien « Tout afficher ».
    } finally {
      setIsLoading(false);
    }
  }, []);

  useNotificationSocket(
    useCallback(() => {
      // La charge utile du socket porte le contenu de la diffusion, pas
      // l'identifiant de *notre* ligne de distribution — celui qu'il faudrait
      // pour marquer lu. On relit donc la synthèse plutôt que d'insérer à
      // l'aveugle un élément qu'on ne saurait pas manipuler ensuite.
      void loadSummary();
      toast.info(t("toast.received"));
      // Rafraîchit le rendu serveur : la page `/notifications`, si elle est
      // affichée, se remplit sans intervention.
      router.refresh();
    }, [loadSummary, router, t]),
  );

  // Fermeture au clic extérieur et à Échap : le panneau n'est pas un `<dialog>`
  // modal, il ne doit pas piéger le focus ni bloquer le reste de la barre.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) void loadSummary();
  };

  const handleMarkAll = () => {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) {
        toast.error(message(result.message));
        return;
      }
      setUnreadCount(0);
      setItems((current) =>
        current?.map((item) => ({ ...item, isRead: true })) ?? current,
      );
      router.refresh();
    });
  };

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={
          unreadCount > 0
            ? t("bell.labelWithCount", { count: String(unreadCount) })
            : t("bell.label")
        }
        className={cn(
          "text-muted hover:bg-subtle hover:text-foreground relative rounded-lg p-1.5",
          "focus-visible:outline-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2",
        )}
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 ? (
          <span
            className={cn(
              "bg-brand-500 text-secondary-900 absolute -top-0.5 -right-0.5",
              "flex min-w-4 items-center justify-center rounded-full px-1",
              "text-[10px] leading-4 font-semibold",
            )}
            // Le nombre est déjà porté par `aria-label` : le répéter ferait
            // annoncer « 3 notifications non lues, 3 » au lecteur d'écran.
            aria-hidden
          >
            {unreadCount > BADGE_MAX ? `${BADGE_MAX}+` : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          id={panelId}
          role="group"
          aria-label={t("bell.panelLabel")}
          className={cn(
            "border-subtle bg-surface absolute top-full right-0 z-50 mt-2",
            "w-80 overflow-hidden rounded-xl border shadow-lg",
          )}
        >
          <div className="border-subtle flex items-center justify-between gap-2 border-b px-4 py-3">
            <p className="text-sm font-medium">{t("bell.title")}</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={isPending}
                className={cn(
                  "text-brand-700 flex items-center gap-1 text-xs font-medium",
                  "hover:underline disabled:opacity-60",
                )}
              >
                <CheckCheck className="size-3.5" aria-hidden />
                {t("markAllRead")}
              </button>
            ) : null}
          </div>

          {isLoading && items === null ? (
            <p className="text-muted px-4 py-6 text-center text-sm">
              {t("bell.loading")}
            </p>
          ) : items && items.length > 0 ? (
            <ul className="divide-subtle max-h-80 divide-y overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn("px-4 py-3", !item.isRead && "bg-brand-500/5")}
                >
                  <div className="flex items-start gap-2">
                    {!item.isRead ? (
                      <span
                        className="bg-brand-500 mt-1.5 size-1.5 shrink-0 rounded-full"
                        aria-hidden
                      />
                    ) : (
                      <span className="mt-1.5 size-1.5 shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      {item.subtitle ? (
                        <p className="text-muted line-clamp-2 text-xs">
                          {item.subtitle}
                        </p>
                      ) : null}
                      {item.createdAt ? (
                        <time
                          dateTime={item.createdAt}
                          className="text-muted mt-1 block text-[11px]"
                        >
                          {format.dateTime(new Date(item.createdAt), "dateTime")}
                        </time>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted px-4 py-6 text-center text-sm">
              {t("bell.empty")}
            </p>
          )}

          <div className="border-subtle border-t px-4 py-2.5">
            <Link
              href={ROUTES.notifications}
              onClick={() => setIsOpen(false)}
              className="text-brand-700 block text-center text-sm font-medium hover:underline"
            >
              {t("bell.seeAll")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
