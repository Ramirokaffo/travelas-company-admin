import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { CompanyInactiveBanner } from "@/components/layout/company-inactive-banner";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { BrandLogo } from "@/components/ui/brand-logo";
import { countUnreadNotifications } from "@/features/notifications/api";
import { getAuthorizedToken, requireSession } from "@/lib/auth/session";
import { SIDEBAR_COOKIE, parseSidebarState } from "@/lib/layout/sidebar-state";

/**
 * Layout des pages protégées.
 *
 * `requireSession()` est la véritable barrière d'accès : elle interroge le
 * backend, vérifie que le compte est actif et que le rôle est `company_admin`.
 * Le middleware, lui, ne fait qu'un contrôle de présence de cookie.
 *
 * Chaque page et chaque Server Action doit malgré tout appeler
 * `requireSession()` / `requireCompanySession()` : un layout parent ne protège
 * pas une Server Action invoquée directement.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const t = await getTranslations();
  const sidebarState = parseSidebarState((await cookies()).get(SIDEBAR_COOKIE)?.value);

  // La pastille est un agrément : un module `notification` indisponible ne doit
  // pas faire tomber toutes les pages du dashboard, qui partagent ce layout.
  const unreadNotifications = await countUnreadNotifications(
    await getAuthorizedToken(),
  ).catch(() => 0);

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        companyName={session.company?.name ?? t("common.myCompany")}
        companyLogo={session.company?.logo ?? null}
        initialState={sidebarState}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={session} unreadNotifications={unreadNotifications} />

        {/* Rappel permanent : sans activation, les trajets créés ici
            n'apparaissent pas dans l'application mobile des voyageurs. */}
        {session.company && !session.company.isActive ? (
          <CompanyInactiveBanner />
        ) : null}

        <main className="flex-1 p-5 lg:p-8">{children}</main>

        <footer className="border-subtle bg-surface flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <div className="flex items-center gap-2">
            <BrandLogo brand="novatech" height={22} />
            <span className="text-muted text-xs">
              {t("brand.copyright", { year: String(new Date().getFullYear()) })}
            </span>
          </div>
          <span className="text-muted text-xs">{t("brand.poweredBy")}</span>
        </footer>
      </div>
    </div>
  );
}
