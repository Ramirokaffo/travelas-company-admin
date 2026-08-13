import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { ListFilters } from "@/components/layout/list-filters";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { countUnreadNotifications, listMyNotifications } from "@/features/notifications/api";
import { MarkAllReadButton } from "@/features/notifications/components/mark-all-read-button";
import { NotificationRowActions } from "@/features/notifications/components/notification-row-actions";
import {
  NOTIFICATION_FILTER_PARAM,
  NOTIFICATION_TYPES,
  parseNotificationFilters,
} from "@/features/notifications/schemas";
import { TABLE_PARAM, parseTableQuery, toPageMeta } from "@/lib/api/data-table";
import { getAuthorizedToken, requireSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("notifications") };
}

/**
 * Centre de notification : la boîte de réception du compte connecté.
 *
 * `requireSession()` et **non** `requireCompanySession()` : les notifications
 * s'adressent au compte, pas à l'entreprise. Un chef d'entreprise dont
 * l'onboarding n'est pas terminé reçoit déjà des messages de la plateforme et
 * doit pouvoir les lire — l'envoyer vers l'onboarding depuis la cloche, visible
 * sur toutes les pages, serait un cul-de-sac.
 *
 * `parseTableQuery` est appelé **sans `sortableColumns`** :
 * `UserNotificationFilterDto` n'accepte ni `orderBy` ni `order`, et le
 * `ValidationPipe` global (`forbidNonWhitelisted`) ferait échouer toute la
 * liste en 400. Le backend trie de toute façon par date décroissante, ce qui
 * est le seul ordre utile ici.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const t = await getTranslations("notifications");
  const format = await getFormatter();
  const locale = await getLocale();
  const params = await searchParams;

  const query = parseTableQuery(params);
  const filters = parseNotificationFilters(params);
  const token = await getAuthorizedToken();

  const [page, unreadCount] = await Promise.all([
    listMyNotifications(query, filters, token, locale),
    countUnreadNotifications(token).catch(() => 0),
  ]);

  const meta = toPageMeta(query, page);
  const isFiltered = Boolean(query.search) || filters.status !== "all" || filters.type !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle", { count: String(unreadCount) })}
        actions={<MarkAllReadButton unreadCount={unreadCount} />}
      />

      <Card className="overflow-hidden">
        <div className="border-subtle border-b">
          <ListFilters
            id="notifications"
            search={{
              param: TABLE_PARAM.search,
              value: query.search ?? "",
              label: t("filters.searchLabel"),
              placeholder: t("filters.searchPlaceholder"),
            }}
            selects={[
              {
                param: NOTIFICATION_FILTER_PARAM.status,
                label: t("filters.status"),
                value: filters.status === "all" ? "" : filters.status,
                options: [
                  { value: "", label: t("filters.allStatuses") },
                  { value: "unread", label: t("filters.unread") },
                ],
              },
              {
                param: NOTIFICATION_FILTER_PARAM.type,
                label: t("filters.type"),
                value: filters.type === "all" ? "" : filters.type,
                options: [
                  { value: "", label: t("filters.allTypes") },
                  ...NOTIFICATION_TYPES.map((type) => ({
                    value: type,
                    label: t(`types.${type}`),
                  })),
                ],
              },
            ]}
          />
        </div>

        {page.items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t(isFiltered ? "empty.filteredTitle" : "empty.title")}
            description={t(
              isFiltered ? "empty.filteredDescription" : "empty.description",
            )}
          />
        ) : (
          <ul className="divide-subtle divide-y">
            {page.items.map((notification) => (
              <li
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 px-5 py-4",
                  // Fond très légèrement teinté pour les non-lues. La couleur ne
                  // porte pas seule l'information : le badge « Non lue » la dit.
                  !notification.isRead && "bg-brand-500/5",
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <Badge variant="neutral">{t(`types.${notification.type}`)}</Badge>
                    {!notification.isRead ? (
                      <Badge variant="brand">{t("unreadBadge")}</Badge>
                    ) : null}
                  </div>

                  {notification.subtitle ? (
                    <p className="text-sm">{notification.subtitle}</p>
                  ) : null}
                  {notification.description ? (
                    <p className="text-muted text-sm">{notification.description}</p>
                  ) : null}

                  {notification.createdAt ? (
                    <time
                      dateTime={notification.createdAt}
                      className="text-muted block text-xs"
                    >
                      {format.dateTime(new Date(notification.createdAt), "dateTime")}
                    </time>
                  ) : null}
                </div>

                <NotificationRowActions notification={notification} />
              </li>
            ))}
          </ul>
        )}

        <Pagination query={query} meta={meta} itemLabel={t("itemLabel")} />
      </Card>
    </div>
  );
}
