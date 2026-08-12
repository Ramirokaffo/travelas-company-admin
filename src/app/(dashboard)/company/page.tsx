import { Building2, MapPin, Star, Users } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Image from "next/image";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCompanyProfile } from "@/features/company/api";
import { CompanySettingsForm } from "@/features/company/components/company-settings-form";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("company") };
}

/**
 * Fiche de l'entreprise et ses réglages.
 *
 * L'identifiant vient de la **session**, jamais de l'URL : la page n'est pas
 * paramétrée, il n'y a qu'une entreprise par compte (`POST /company` refuse la
 * seconde). C'est aussi ce qui rend impossible la lecture de la fiche d'un
 * concurrent en changeant un segment d'adresse — `GET /company/:companyId`
 * n'étant, lui, pas cadré côté backend.
 *
 * Le taux de commission de la plateforme est affiché mais **non modifiable** :
 * `UpdateCompanyDto` ne le porte pas, il relève d'`AdminUpdateCompanyDto`. Le
 * montrer en lecture seule vaut mieux que de le taire — c'est ce qui explique
 * l'écart entre la recette brute et ce que l'entreprise perçoit.
 */
export default async function CompanyPage() {
  const session = await requireCompanySession();
  const t = await getTranslations("company");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();

  const token = await getAuthorizedToken();
  const company = await getCompanyProfile(session.company.id, token);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card className="overflow-hidden">
        {/* Bannière : `unoptimized` parce que l'hôte de stockage n'est pas
            toujours celui déclaré dans `next.config.ts` selon l'environnement,
            et qu'un échec d'optimisation rendrait une image cassée. */}
        <div className="bg-subtle relative h-32 w-full sm:h-40">
          {company.bannerImage ? (
            <Image
              src={company.bannerImage}
              alt=""
              fill
              unoptimized
              className="object-cover"
            />
          ) : null}
        </div>

        <CardContent className="flex flex-wrap items-start gap-4">
          <div className="border-subtle bg-surface relative -mt-12 size-20 shrink-0 overflow-hidden rounded-2xl border">
            {company.logo ? (
              <Image
                src={company.logo}
                alt=""
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <span className="text-muted flex size-full items-center justify-center">
                <Building2 className="size-8" aria-hidden />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">
                {company.name ?? tCommon("yourCompany")}
              </h2>
              {company.isActive ? (
                <Badge variant="success">{t("status.active")}</Badge>
              ) : (
                <Badge variant="warning">{t("status.pending")}</Badge>
              )}
            </div>

            {!company.isActive ? (
              <p className="text-muted text-sm">{t("status.pendingHelp")}</p>
            ) : null}

            <dl className="text-muted flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex items-center gap-1.5">
                <Star className="size-4" aria-hidden />
                <dt className="sr-only">{t("rating")}</dt>
                <dd>
                  {company.ratingCount > 0
                    ? t("ratingValue", {
                        rating: format.number(company.ratingAverage),
                        count: company.ratingCount,
                      })
                    : t("noRating")}
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                <dt className="sr-only">{t("fee")}</dt>
                <dd>
                  {company.requiredFee
                    ? t("feeValue", { percent: format.number(company.feePercent) })
                    : t("noFee")}
                </dd>
              </div>
              {session.seat ? (
                <div className="flex items-center gap-1.5">
                  <Users className="size-4" aria-hidden />
                  <dt className="sr-only">{t("mySeat")}</dt>
                  <dd>{t("mySeatValue", { seat: session.seat.name ?? "—" })}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("form.title")}</CardTitle>
          <CardDescription>{t("form.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CompanySettingsForm company={company} />
        </CardContent>
      </Card>
    </div>
  );
}
