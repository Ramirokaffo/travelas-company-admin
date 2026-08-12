import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BrandLogo } from "@/components/ui/brand-logo";
import { requireSession } from "@/lib/auth/session";

/**
 * Layout de l'onboarding — dernière étape de l'inscription.
 *
 * Groupe de routes distinct de `(dashboard)` : tant qu'aucune entreprise
 * n'existe, la barre latérale ne mènerait qu'à des pages qui renvoient
 * aussitôt ici (`requireCompanySession()`). On garde donc un chrome minimal,
 * avec ce qui reste utile — langue, thème, déconnexion.
 *
 * `requireSession()` protège l'accès : cette page suppose un compte, pas une
 * entreprise.
 */
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  await requireSession();
  const t = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-subtle bg-surface flex h-16 items-center justify-between gap-4 border-b px-5">
        <BrandLogo height={28} decorative priority />

        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <SignOutButton compact />
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-6">{children}</div>
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
