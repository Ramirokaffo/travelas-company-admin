import { AlertTriangle, Percent, Star, Ticket, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { RankingBars } from "@/components/charts/ranking-bars";
import { TrendChart } from "@/components/charts/trend-chart";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import {
  getDashboardSeries,
  getDashboardStats,
  getDetailedMetrics,
  getTopSeats,
} from "@/features/analytics/api";
import { PeriodFilter } from "@/features/analytics/components/period-filter";
import { parsePeriod } from "@/features/analytics/period";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("statistics") };
}

/**
 * Vue comparative multi-agences.
 *
 * Complète `/dashboard` plutôt que de le doubler : là où la vue d'ensemble
 * répond à « comment va l'entreprise ce mois-ci ? », celle-ci répond à « d'où
 * vient le chiffre, et quelles agences tirent le résultat ? ».
 *
 * Deux séries sont superposées sur **un seul axe** — recette encaissée et part
 * prélevée par Travelas, toutes deux en francs CFA. Une seconde échelle
 * verticale inventerait une corrélation absente des données ; c'est justement
 * parce que les deux grandeurs sont de même nature qu'elles peuvent partager
 * l'axe.
 */
export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCompanySession();
  const t = await getTranslations("statistics");
  const tAnalytics = await getTranslations("analytics");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();

  const period = parsePeriod(await searchParams);
  const token = await getAuthorizedToken();

  const [stats, revenueSeries, feeSeries, passengerSeries, topSeats, metrics] =
    await Promise.all([
      getDashboardStats(period, token),
      getDashboardSeries("revenue", period, token),
      getDashboardSeries("fees", period, token),
      getDashboardSeries("passengers", period, token),
      getTopSeats(period, token, { limit: 10 }),
      getDetailedMetrics(period, token),
    ]);

  const revenue = stats?.revenue;
  const tickets = stats?.tickets;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle", {
          company: session.company.name ?? tCommon("yourCompany"),
        })}
        actions={<PeriodFilter period={period} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={tAnalytics("metrics.revenue")}
          value={format.number(revenue?.total ?? 0, "currency")}
          icon={Wallet}
          change={revenue?.change ?? null}
          trend={revenue?.trend}
        />
        <StatCard
          label={tAnalytics("metrics.passengers")}
          value={format.number(tickets?.total ?? 0)}
          icon={Ticket}
          change={tickets?.change ?? null}
          trend={tickets?.trend}
        />
        <StatCard
          label={t("metrics.averageTicket")}
          value={format.number(metrics?.averageOrderValue ?? 0, "currency")}
          icon={Percent}
          hint={t("metrics.averageTicketHint")}
        />
        <StatCard
          label={t("metrics.satisfaction")}
          value={t("metrics.rating", {
            rating: format.number(metrics?.satisfactionRate ?? 0),
          })}
          icon={Star}
          hint={t("metrics.satisfactionHint")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("charts.revenueVsFees")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Deux séries : la légende est obligatoire — l'identité ne doit
              jamais reposer sur la seule couleur. */}
          <ul className="flex flex-wrap gap-4 text-xs">
            <SeriesKey slot={1} label={tAnalytics("metrics.revenue")} />
            <SeriesKey slot={2} label={tAnalytics("metrics.platformFee")} />
          </ul>

          {revenueSeries && feeSeries ? (
            <TrendChart
              height={300}
              series={[
                {
                  key: "revenue",
                  label: tAnalytics("metrics.revenue"),
                  points: revenueSeries,
                  slot: 1,
                  currency: true,
                },
                {
                  key: "fees",
                  label: tAnalytics("metrics.platformFee"),
                  points: feeSeries,
                  slot: 2,
                  currency: true,
                },
              ]}
            />
          ) : (
            <p className="text-muted py-16 text-center text-sm">
              {tAnalytics("unavailable")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("charts.seatRanking")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingBars
              rows={(topSeats ?? []).map((seat) => ({
                id: seat.id,
                label: seat.name ?? tAnalytics("unnamedSeat"),
                value: seat.revenue,
                caption: tAnalytics("ticketCount", { count: seat.tickets }),
              }))}
              currency
              emptyLabel={
                topSeats === null ? tAnalytics("unavailable") : tAnalytics("noData")
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tAnalytics("charts.passengersTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {passengerSeries ? (
              <TrendChart
                series={[
                  {
                    key: "passengers",
                    label: tAnalytics("metrics.passengers"),
                    points: passengerSeries,
                    slot: 3,
                  },
                ]}
              />
            ) : (
              <p className="text-muted py-16 text-center text-sm">
                {tAnalytics("unavailable")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-muted flex items-start gap-2 text-xs">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("disclaimer")}
      </p>
    </div>
  );
}

/** Clé de légende : pastille colorée + libellé en jeton de texte. */
function SeriesKey({ slot, label }: { slot: 1 | 2 | 3; label: string }) {
  return (
    <li className="text-muted flex items-center gap-2">
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{ background: `var(--chart-${slot})` }}
      />
      {label}
    </li>
  );
}
