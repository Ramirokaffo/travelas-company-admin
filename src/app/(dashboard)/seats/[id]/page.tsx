import { ArrowLeft, Eye, MapPin, Pencil, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ROUTES } from "@/constants/routes";
import { listCompanyRecipes } from "@/features/analytics/api";
import { RecipeTable } from "@/features/analytics/components/recipe-table";
import { sumRecipes } from "@/features/analytics/schemas";
import { listSeatIssues } from "@/features/incidents/api";
import { IssueList } from "@/features/incidents/components/issue-list";
import { listSeatJourneys } from "@/features/journeys/api";
import { JourneyTable } from "@/features/journeys/components/journey-table";
import { getSeatDetail } from "@/features/seats/api";
import { SeatContacts } from "@/features/seats/components/seat-contacts";
import { listSeatContacts } from "@/features/seats/contacts-api";
import { listSeatStaff } from "@/features/staff/api";
import { ApiError } from "@/lib/api/errors";
import { canWriteOnSeat } from "@/lib/auth/scope";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

/**
 * Titre générique, sans charger l'agence.
 *
 * Mettre le nom de l'agence dans l'onglet coûterait une seconde lecture de
 * `GET /seat/:seatId` — et surtout obligerait à envelopper `requireSession()`
 * dans un `try`. Or `redirect()` et `notFound()` de Next signalent leur
 * intention **en levant** : un `catch` les avale, et la redirection vers la
 * connexion ne se produit plus. Un titre d'onglet ne vaut pas ce risque.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("seats"))("title") };
}

/**
 * Fiche détaillée d'une agence.
 *
 * L'identifiant vient de l'URL, donc du navigateur. C'est `GET /seat/:seatId`
 * qui le valide : `assertSeatBelongsToUser()` refuse en 403 l'agence d'une autre
 * entreprise et en 404 un identifiant inconnu. Les deux sont traduits en page
 * « introuvable » — distinguer les deux cas dirait à un attaquant que l'agence
 * existe bel et bien, chez quelqu'un d'autre.
 *
 * L'agence est chargée **avant** ses données rattachées, et volontairement pas
 * en parallèle : les endpoints par agence (`/company-journey/bySeat`,
 * `/daily-recipe/myCompany?seatId=`) ne sont sûrs que parce que l'identifiant a
 * déjà été validé.
 *
 * Portée d'écriture : les contacts ne s'éditent que depuis l'agence de
 * rattachement du chef d'entreprise (`canWriteOnSeat`, §2 de PLAN.md). Ailleurs,
 * la fiche est en lecture — et le rappelle explicitement plutôt que de faire
 * disparaître le bloc sans explication.
 */
export default async function SeatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCompanySession();
  const t = await getTranslations("seats.detail");
  const tSeats = await getTranslations("seats");
  const tAnalytics = await getTranslations("analytics");
  const tRevenue = await getTranslations("revenue");
  const tStaff = await getTranslations("staff");
  const tRoles = await getTranslations("roles");
  const format = await getFormatter();

  const { id } = await params;
  const token = await getAuthorizedToken();

  let seat;
  try {
    seat = await getSeatDetail(id, token);
  } catch (error) {
    if (error instanceof ApiError && (error.isForbidden || error.status === 404)) {
      notFound();
    }
    throw error;
  }

  const [staff, contacts, recipes, journeys, issues] = await Promise.all([
    listSeatStaff(id, token, { limit: 20 }),
    listSeatContacts(id, token),
    listCompanyRecipes({ page: 0, count: 7, seatId: id, withCount: false }, token),
    listSeatJourneys(id, token, { limit: 5 }),
    listSeatIssues(id, token, { limit: 5 }),
  ]);

  const totals = sumRecipes(recipes.items);
  const canWrite = canWriteOnSeat(session, id);
  const name = seat.name ?? tSeats("unnamed");

  return (
    <div className="space-y-6">
      <Link
        href={ROUTES.seats}
        className="text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("backToList")}
      </Link>

      <PageHeader
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              {seat.agency
                ? [seat.agency.city, seat.agency.name].filter(Boolean).join(" · ")
                : tSeats("noAgency")}
            </span>
            {seat.street ? <span>{seat.street}</span> : null}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {seat.isActive ? (
              <Badge variant="success">{tSeats("statusValues.active")}</Badge>
            ) : (
              <Badge variant="warning">{tSeats("statusValues.inactive")}</Badge>
            )}
            {seat.isMain ? <Badge variant="brand">{tSeats("main")}</Badge> : null}
            <Link
              href={ROUTES.seats}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <Pencil className="size-4" aria-hidden />
              {t("manage")}
            </Link>
          </div>
        }
      />

      {!canWrite ? (
        <p
          role="status"
          className="text-muted bg-subtle flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("readOnly")}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("stats.revenue")}
          value={format.number(totals.revenue, "currency")}
          icon={Wallet}
          hint={t("stats.lastDays", { days: recipes.items.length })}
        />
        <StatCard
          label={t("stats.passengers")}
          value={format.number(totals.passengers)}
          hint={t("stats.lastDays", { days: recipes.items.length })}
        />
        <StatCard
          label={t("stats.staff")}
          value={format.number(staff.length)}
          icon={Users}
          hint={t("stats.staffHint")}
        />
        <StatCard
          label={t("stats.openIssues")}
          value={format.number(issues.filter((issue) => !issue.isResolved).length)}
          invertTrend
          hint={t("stats.openIssuesHint")}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("recipes.title")}</CardTitle>
            <CardDescription>{t("recipes.description")}</CardDescription>
          </CardHeader>
          <RecipeTable recipes={recipes.items} isFiltered={false} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tSeats("contacts.title")}</CardTitle>
            <CardDescription>{tSeats("contacts.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {canWrite ? (
              <SeatContacts seatId={id} contacts={contacts} />
            ) : contacts.length === 0 ? (
              <p className="text-muted text-sm">{tSeats("contacts.empty")}</p>
            ) : (
              <ul className="divide-subtle divide-y">
                {contacts.map((contact) => (
                  <li key={contact.id} className="py-2.5">
                    <p className="text-sm font-medium tabular-nums">
                      {contact.phoneNumber}
                    </p>
                    {contact.label ? (
                      <p className="text-muted text-xs">{contact.label}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        {/* Pas de lien « tout voir » filtré sur l'agence : `UserFilterDto`
            n'expose pas `seatId`, la page `/staff` ne saurait pas honorer le
            paramètre. Un lien qui ne filtre rien vaut moins que pas de lien. */}
        <CardHeader
          action={
            <Link
              href={ROUTES.staff}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {t("seeAll")}
            </Link>
          }
        >
          <CardTitle>{t("team.title")}</CardTitle>
          <CardDescription>{t("team.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <p className="text-muted text-sm">{t("team.empty")}</p>
          ) : (
            <ul className="divide-subtle divide-y">
              {staff.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.fullName}</p>
                    <p className="text-muted truncate text-xs">
                      {member.email ?? member.phoneNumber ?? "—"}
                    </p>
                  </div>
                  <Badge>{tRoles(member.role)}</Badge>
                  {member.isBlocked ? (
                    <Badge variant="danger">{tStaff("statusValues.blocked")}</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          action={
            <Link
              href={`${ROUTES.journeys}?agence=${encodeURIComponent(id)}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {t("seeAll")}
            </Link>
          }
        >
          <CardTitle>{t("journeys.title")}</CardTitle>
          <CardDescription>{t("journeys.description")}</CardDescription>
        </CardHeader>
        <JourneyTable journeys={journeys} isFiltered={false} hideSeat />
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          action={
            <Link
              href={`${ROUTES.incidents}?agence=${encodeURIComponent(id)}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {t("seeAll")}
            </Link>
          }
        >
          <CardTitle>{t("issues.title")}</CardTitle>
          <CardDescription>{tAnalytics("lastFive")}</CardDescription>
        </CardHeader>
        <IssueList issues={issues} isFiltered={false} actionable={canWrite} />
      </Card>

      <p className="text-muted text-xs">{tRevenue("totals.pageScope")}</p>
    </div>
  );
}
