import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BrandLogo } from "@/components/ui/brand-logo";
import { publicEnv } from "@/lib/config/public-env";

/**
 * Layout des pages accessibles sans session (connexion, inscription…).
 *
 * Les sélecteurs de langue et de thème y figurent : ils doivent être
 * atteignables avant toute authentification, sans quoi un utilisateur
 * anglophone découvrirait l'application en français jusqu'à sa connexion.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center justify-end gap-2 px-4 py-4">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <main className="flex flex-1 items-center justify-center px-4 py-6">
        {/* La largeur est laissée aux pages : la connexion tient dans une
            colonne étroite, l'inscription a besoin de deux. */}
        <div className="w-full max-w-2xl">
          <div className="mx-auto mb-8 flex max-w-md flex-col items-center text-center">
            <BrandLogo height={40} priority />
            <h1 className="mt-4 text-2xl font-semibold">{publicEnv.appName}</h1>
            <p className="text-muted mt-1 text-sm">{t("auth.appSubtitle")}</p>
          </div>
          {children}
        </div>
      </main>

      <footer className="flex flex-col items-center gap-1 px-4 pb-8">
        <BrandLogo brand="novatech" height={22} />
        <p className="text-muted text-xs">
          {t("brand.copyright", { year: String(new Date().getFullYear()) })} —{" "}
          {t("brand.poweredBy")}
        </p>
      </footer>
    </div>
  );
}
