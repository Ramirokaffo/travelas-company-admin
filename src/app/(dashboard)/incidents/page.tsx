import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ListFilters } from "@/components/layout/list-filters";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { listCompanyIssues, listCompanySpeedIssues } from "@/features/incidents/api";
import { IssueList } from "@/features/incidents/components/issue-list";
import { SpeedIssueTable } from "@/features/incidents/components/speed-issue-table";
import {
  INCIDENT_FILTER_PARAM,
  INCIDENT_TABS,
  parseIncidentFilters,
  type IncidentTab,
} from "@/features/incidents/schemas";
import { listCompanySeatOptions } from "@/features/seats/api";
import { TABLE_PARAM, parseTableQuery, toPageMeta } from "@/lib/api/data-table";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("incidents") };
}

/**
 * Incidents : signalements de voyageurs et excès de vitesse.
 *
 * Deux sources qui n'ont ni la même forme ni le même cycle de vie — d'où deux
 * onglets plutôt qu'une liste unifiée. L'onglet vit dans l'URL, comme les
 * filtres : la vue reste partageable.
 *
 * Une seule des deux listes est chargée par rendu. Les charger toutes les deux
 * pour n'en afficher qu'une doublerait le coût backend de chaque visite.
 */
export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCompanySession();
  const t = await getTranslations("incidents");
  const tCommon = await getTranslations("common");
  const tSeats = await getTranslations("seats");
  const params = await searchParams;

  const query = parseTableQuery(params);
  const filters = parseIncidentFilters(params);
  const token = await getAuthorizedToken();

  const isReports = filters.tab === "reports";

  // Deux branches typées plutôt qu'un appel unique : les deux endpoints ne
  // renvoient pas le même objet, et les réunir imposerait un cast — que la
  // règle 6 de CLAUDE.md interdit précisément sur des données réseau.
  const [issuePage, seats] = isReports
    ? await Promise.all([
        listCompanyIssues(query, filters, token),
        listCompanySeatOptions(token),
      ])
    : [null, []];
  const speedPage = isReports ? null : await listCompanySpeedIssues(query, token);

  const page = issuePage ?? speedPage ?? { items: [], total: null };
  const meta = toPageMeta(query, page);
  const isFiltered =
    Boolean(query.search) || Boolean(filters.seatId) || filters.status !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle", {
          company: session.company.name ?? tCommon("yourCompany"),
        })}
      />

      <nav aria-label={t("tabsLabel")} className="border-subtle flex gap-1 border-b">
        {INCIDENT_TABS.map((tab) => (
          <TabLink key={tab} tab={tab} current={filters.tab} label={t(`tabs.${tab}`)} />
        ))}
      </nav>

      <Card className="overflow-hidden">
        <div className="border-subtle border-b">
          <ListFilters
            id="incidents"
            search={{
              param: TABLE_PARAM.search,
              value: query.search ?? "",
              label: t("filters.searchLabel"),
              placeholder: t(
                isReports
                  ? "filters.searchPlaceholder"
                  : "speeding.filters.searchPlaceholder",
              ),
            }}
            selects={
              isReports
                ? [
                    {
                      param: INCIDENT_FILTER_PARAM.status,
                      label: t("filters.status"),
                      value: filters.status === "all" ? "" : filters.status,
                      options: [
                        { value: "", label: t("filters.allStatuses") },
                        { value: "open", label: t("open") },
                        { value: "resolved", label: t("resolved") },
                      ],
                    },
                    {
                      param: INCIDENT_FILTER_PARAM.seat,
                      label: t("filters.seat"),
                      value: filters.seatId ?? "",
                      className: "w-56",
                      options: [
                        { value: "", label: t("filters.allSeats") },
                        ...seats.map((seat) => ({
                          value: seat.id,
                          label: seat.name ?? tSeats("unnamed"),
                        })),
                      ],
                    },
                  ]
                : []
            }
          />
        </div>

        {issuePage ? (
          <IssueList issues={issuePage.items} isFiltered={isFiltered} />
        ) : (
          <SpeedIssueTable issues={speedPage?.items ?? []} isFiltered={isFiltered} />
        )}

        <Pagination
          query={query}
          meta={meta}
          itemLabel={t(isReports ? "itemLabel" : "speeding.itemLabel")}
        />
      </Card>
    </div>
  );
}

/**
 * Onglet sous forme de lien.
 *
 * Changer d'onglet réinitialise les filtres : les critères d'un signalement
 * (statut, agence) n'ont aucun sens sur un relevé de vitesse, et les laisser
 * dans l'URL produirait une requête refusée en 400.
 */
function TabLink({
  tab,
  current,
  label,
}: {
  tab: IncidentTab;
  current: IncidentTab;
  label: string;
}) {
  const isActive = tab === current;
  const href =
    tab === "reports" ? "/incidents" : `/incidents?${INCIDENT_FILTER_PARAM.tab}=${tab}`;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
        isActive
          ? "border-brand-500 text-brand-700 dark:text-brand-300"
          : "text-muted hover:text-foreground border-transparent",
      )}
    >
      {label}
    </Link>
  );
}
