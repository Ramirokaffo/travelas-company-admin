"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { CompanyLogo } from "@/components/layout/company-logo";
import { NAV_SECTIONS } from "@/components/layout/nav-items";
import { BrandLogo } from "@/components/ui/brand-logo";
import { ROUTES } from "@/constants/routes";
import { persistSidebarState, type SidebarState } from "@/lib/layout/sidebar-state";
import { cn } from "@/lib/utils/cn";

type SidebarProps = {
  companyName: string;
  companyLogo: string | null;
  /** État résolu côté serveur depuis le cookie : évite un repli après hydratation. */
  initialState?: SidebarState;
};

/**
 * Barre latérale du dashboard, pliable en rail d'icônes.
 *
 * L'état initial vient du serveur (cookie `travelas_sidebar`), pas d'un
 * `useEffect` : lire la préférence après le montage ferait s'afficher la barre
 * dépliée le temps d'un rendu, puis se replier sous les yeux de l'utilisateur.
 *
 * Repliée, la barre ne masque pas les libellés « pour faire joli » : chaque
 * lien conserve son texte pour les lecteurs d'écran (`sr-only`) et le rappelle
 * en infobulle à la souris. Un rail d'icônes muettes serait inutilisable au
 * clavier comme à la synthèse vocale.
 */
export function Sidebar({
  companyName,
  companyLogo,
  initialState = "expanded",
}: SidebarProps) {
  const t = useTranslations("nav");
  const tBrand = useTranslations("brand");
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialState === "collapsed");

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    persistSidebarState(next ? "collapsed" : "expanded");
  };

  return (
    <aside
      className={cn(
        "border-subtle bg-surface hidden shrink-0 border-r transition-[width] duration-200 lg:block",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div
        className={cn(
          "border-subtle flex h-16 items-center border-b",
          collapsed ? "justify-center px-2" : "justify-between px-5",
        )}
      >
        {collapsed ? null : (
          <Link href={ROUTES.dashboard} aria-label={tBrand("dashboardHome")}>
            <BrandLogo height={28} decorative priority />
          </Link>
        )}

        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("expand") : t("collapse")}
          title={collapsed ? t("expand") : t("collapse")}
          className="text-muted hover:bg-subtle hover:text-foreground focus-visible:outline-brand-500 rounded-lg p-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" aria-hidden />
          ) : (
            <PanelLeftClose className="size-5" aria-hidden />
          )}
        </button>
      </div>

      <div
        className={cn(
          "border-subtle flex items-center gap-3 border-b py-3",
          collapsed ? "justify-center px-2" : "px-5",
        )}
        title={collapsed ? companyName : undefined}
      >
        <CompanyLogo src={companyLogo} size={collapsed ? 36 : 40} />

        {collapsed ? (
          <span className="sr-only">{companyName}</span>
        ) : (
          <div className="min-w-0">
            <p className="text-muted text-[11px] font-semibold tracking-wider uppercase">
              {t("company")}
            </p>
            <p className="truncate text-sm font-semibold" title={companyName}>
              {companyName}
            </p>
          </div>
        )}
      </div>

      <nav
        className={cn("space-y-6 py-4", collapsed ? "px-2" : "px-4")}
        aria-label={t("main")}
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.key}>
            <p
              className={cn(
                "text-muted text-xs font-semibold tracking-wider uppercase",
                // Replié, l'intitulé de section n'a pas la place de s'afficher
                // mais reste annoncé : c'est lui qui structure la navigation.
                collapsed ? "sr-only" : "px-3 pb-2",
              )}
            >
              {t(`sections.${section.key}`)}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const label = t(`items.${item.key}`);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg py-2 text-sm transition-colors",
                        collapsed ? "justify-center px-2" : "px-3",
                        isActive
                          ? // En thème sombre, `brand-50` serait une pastille
                            // blanche sur fond bleu nuit : on passe par une
                            // teinte transparente de l'orange.
                            "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 font-medium"
                          : "text-muted hover:bg-subtle hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className={collapsed ? "sr-only" : "truncate"}>
                        {label}
                      </span>
                      {item.soon && !collapsed ? (
                        <span className="bg-subtle text-muted ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium">
                          {t("soon")}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
