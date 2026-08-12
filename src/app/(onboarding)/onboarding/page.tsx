import { BarChart3, Building2, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper";
import { ROUTES } from "@/constants/routes";
import { CompanyOnboardingForm } from "@/features/company/components/company-onboarding-form";
import { requireSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("onboarding") };
}

/** Ce qui devient possible une fois l'entreprise déclarée. */
const NEXT_STEPS = [
  { key: "seats", icon: Building2 },
  { key: "staff", icon: Users },
  { key: "steering", icon: BarChart3 },
] as const;

/**
 * Onboarding — création de l'entreprise (`POST /company`).
 *
 * Destination de `requireCompanySession()` tant que le chef d'entreprise n'a
 * pas d'entreprise rattachée, et dernière étape du parcours d'inscription.
 *
 * Un compte = une entreprise : le backend refuse la seconde création
 * (`UnauthorizedException("Already have company")`), qui orphelinerait la
 * première avec ses agences et ses recettes.
 */
export default async function OnboardingPage() {
  const session = await requireSession();

  // L'entreprise existe déjà : rien à faire ici.
  if (session.company) redirect(ROUTES.dashboard);

  const t = await getTranslations("onboarding");
  const tSteps = await getTranslations("auth.steps");

  const steps = [
    { key: "account", label: tSteps("account") },
    { key: "verification", label: tSteps("verification") },
    { key: "company", label: tSteps("company") },
  ];

  return (
    <>
      <Stepper
        steps={steps}
        current={2}
        label={tSteps("label")}
        positionLabel={tSteps("position", { current: "3", total: "3" })}
      />

      <div>
        <h1 className="text-xl font-semibold">
          {t("welcome", { firstName: session.firstName })}
        </h1>
        <p className="text-muted mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <CompanyOnboardingForm />

      <Card>
        <CardHeader>
          <CardTitle>{t("next.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {NEXT_STEPS.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-3">
                <span
                  aria-hidden
                  className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 flex size-8 shrink-0 items-center justify-center rounded-lg"
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t(`next.${key}.title`)}</p>
                  <p className="text-muted text-sm">{t(`next.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
