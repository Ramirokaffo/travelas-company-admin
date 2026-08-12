import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AvatarCard } from "@/features/account/components/avatar-card";
import { EmailSection } from "@/features/account/components/email-section";
import { PasswordForm } from "@/features/account/components/password-form";
import { PreferencesCard } from "@/features/account/components/preferences-card";
import { ProfileForm } from "@/features/account/components/profile-form";
import { requireSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("settings") };
}

/**
 * Réglages du compte.
 *
 * `requireSession()` et non `requireCompanySession()` : ces réglages sont ceux
 * de la personne, pas de l'entreprise. Un compte qui n'a pas terminé son
 * onboarding doit malgré tout pouvoir changer un mot de passe compromis ou
 * corriger son adresse — les rediriger vers `/onboarding` les en empêcherait.
 * Les réglages de l'entreprise, eux, vivent sur `/company`.
 *
 * Aucune donnée n'est chargée ici : tout vient de `getSession()`, qui relit
 * `GET /auth/profile` à chaque rendu (mémoïsé par requête). Un appel
 * supplémentaire ne renverrait rien de plus.
 */
export default async function SettingsPage() {
  const session = await requireSession();
  const t = await getTranslations("settings");
  const tRoles = await getTranslations("roles");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.title")}</CardTitle>
          <CardDescription>{t("profile.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AvatarCard user={session} />
          <div className="border-subtle border-t pt-6">
            <ProfileForm user={session} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("email.title")}</CardTitle>
          <CardDescription>{t("email.cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmailSection user={session} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("password.title")}</CardTitle>
          <CardDescription>{t("password.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("preferences.title")}</CardTitle>
          <CardDescription>{t("preferences.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesCard />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("access.title")}</CardTitle>
          <CardDescription>{t("access.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Lecture seule, et ce n'est pas une commodité : le rôle et le
              rattachement relèvent de la plateforme (`SELF_PROTECTED_FIELDS`
              côté backend). Les afficher explique ce qu'on peut faire ; les
              rendre modifiables ici serait une promesse que le backend refuse
              — à raison, personne ne se promeut soi-même. */}
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-muted text-xs">{t("access.role")}</dt>
              <dd className="text-sm font-medium">{tRoles(session.role)}</dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted text-xs">{t("access.company")}</dt>
              <dd className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {session.company ? (
                  <>
                    <span className="truncate">
                      {session.company.name ?? t("access.unnamedCompany")}
                    </span>
                    {session.company.isActive ? (
                      <Badge variant="success">{t("access.companyActive")}</Badge>
                    ) : (
                      <Badge variant="warning">{t("access.companyPending")}</Badge>
                    )}
                  </>
                ) : (
                  <span className="text-muted">{t("access.noCompany")}</span>
                )}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted text-xs">{t("access.seat")}</dt>
              <dd className="text-sm font-medium">
                {session.seat?.name ?? (
                  <span className="text-muted">{t("access.noSeat")}</span>
                )}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted text-xs">{t("access.userName")}</dt>
              <dd className="text-sm font-medium">{session.userName}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
