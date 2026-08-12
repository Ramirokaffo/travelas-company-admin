import { AlertTriangle, MapPin, Ticket, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";

import { RankingBars } from "@/components/charts/ranking-bars";
import { TrendChart } from "@/components/charts/trend-chart";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ROUTES } from "@/constants/routes";
import {
  getDashboardSeries,
  getDashboardStats,
  getTopSeats,
} from "@/features/analytics/api";
import { PeriodFilter } from "@/features/analytics/components/period-filter";
import { parsePeriod } from "@/features/analytics/period";
import { getAuthorizedToken, requireSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("dashboard") };
}

/**
 * Vue d'ensemble de l'entreprise.
 *
 * Les chiffres viennent de `GET /statistics/dashboard`, qui s'appuie sur
 * `DailyRecipeEntity` — la recette consolidée d'une agence sur une journée,
 * pas la somme des billets. C'est la même base que la page `/revenue`, donc
 * deux écrans qui ne se contrediront pas.
 *
 * ⚠️ Le cadrage sur l'entreprise appelante est **imposé par le backend**
 * (`resolveScope`, chantier E de PLAN.md). Aucun `companyId` ne part d'ici :
 * jusqu'à ce correctif, ces agrégats portaient sur toute la plateforme.
 *
 * Chaque bloc est indépendant : un endpoint de statistiques en panne fait
 * disparaître sa carte, il ne fait pas tomber la page.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const t = await getTranslations("dashboard");
  const tAnalytics = await getTranslations("analytics");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();

  // Sans entreprise, aucune statistique n'existe : on ramène à l'étape
  // manquante plutôt que d'afficher un tableau de bord vide.
  if (!session.company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("greeting", { firstName: session.firstName })}
          description={t("noCompany")}
        />
        <div className="border-subtle bg-surface flex flex-col items-center gap-4 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-muted text-sm">{t("noCompanyHelp")}</p>
          <Link href={ROUTES.onboarding} className={buttonVariants({ size: "lg" })}>
            {t("noCompanyCta")}
          </Link>
        </div>
      </div>
    );
  }

  const period = parsePeriod(await searchParams);
  const token = await getAuthorizedToken();

  const [stats, revenueSeries, passengerSeries, topSeats] = await Promise.all([
    getDashboardStats(period, token),
    getDashboardSeries("revenue", period, token),
    getDashboardSeries("passengers", period, token),
    getTopSeats(period, token, { limit: 5 }),
  ]);

  const revenue = stats?.revenue;
  const fees = stats?.fees;
  const tickets = stats?.tickets;
  const seats = stats?.seats;
  const staff = stats?.users;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("greeting", { firstName: session.firstName })}
        description={t("steering", {
          company: session.company.name ?? tCommon("yourCompany"),
        })}
        actions={<PeriodFilter period={period} />}
      />

      {stats === null ? (
        <p
          role="status"
          className="bg-warning/10 text-warning flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {tAnalytics("unavailable")}
        </p>
      ) : (
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
            label={tAnalytics("metrics.platformFee")}
            value={format.number(fees?.total ?? 0, "currency")}
            icon={Wallet}
            hint={tAnalytics("metrics.platformFeeHint")}
          />
          <StatCard
            label={tAnalytics("metrics.seats")}
            value={format.number(seats?.total ?? 0)}
            icon={MapPin}
            hint={tAnalytics("metrics.seatsHint")}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{tAnalytics("charts.revenueTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueSeries ? (
              <TrendChart
                series={[
                  {
                    key: "revenue",
                    label: tAnalytics("metrics.revenue"),
                    points: revenueSeries,
                    slot: 1,
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

        <Card>
          <CardHeader>
            <CardTitle>{tAnalytics("charts.topSeatsTitle")}</CardTitle>
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
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
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
                    // Emplacement 2 : la couleur suit la grandeur mesurée, pas
                    // la place du graphique dans la page.
                    slot: 2,
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

        <Card>
          <CardHeader>
            <CardTitle>{t("shortcuts.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ShortcutLink
              href={ROUTES.seats}
              label={t("shortcuts.seats")}
              icon="seats"
            />
            <ShortcutLink
              href={ROUTES.staff}
              label={t("shortcuts.staff")}
              icon="staff"
            />
            <ShortcutLink
              href={ROUTES.revenue}
              label={t("shortcuts.revenue")}
              icon="revenue"
            />
            <ShortcutLink
              href={ROUTES.incidents}
              label={t("shortcuts.incidents")}
              icon="incidents"
            />
            {staff ? (
              <p className="text-muted pt-2 text-xs">
                {t("shortcuts.staffCount", { count: staff.total })}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const SHORTCUT_ICONS = {
  seats: MapPin,
  staff: Users,
  revenue: Wallet,
  incidents: AlertTriangle,
} as const;

function ShortcutLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: keyof typeof SHORTCUT_ICONS;
}) {
  const Icon = SHORTCUT_ICONS[icon];

  return (
    <Link
      href={href}
      className="hover:bg-subtle flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
    >
      <Icon className="text-muted size-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}
