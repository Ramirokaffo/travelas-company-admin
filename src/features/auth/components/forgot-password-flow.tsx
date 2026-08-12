"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Stepper } from "@/components/ui/stepper";
import { ROUTES } from "@/constants/routes";
import { ForgotPasswordCodeStep } from "@/features/auth/components/forgot-password-code-step";
import { ForgotPasswordEmailStep } from "@/features/auth/components/forgot-password-email-step";
import { ForgotPasswordResetStep } from "@/features/auth/components/forgot-password-reset-step";

export type ForgotPasswordStep = "email" | "code" | "reset";

type ForgotPasswordFlowProps = {
  /** Étape d'entrée, décidée côté serveur d'après le parcours en cours. */
  initialStep: ForgotPasswordStep;
  pendingEmail: string | null;
};

/**
 * Parcours de réinitialisation : adresse → code → nouveau mot de passe.
 *
 * Les trois étapes tiennent dans une page, sans navigation, mais **rien n'est
 * conservé côté navigateur** : l'adresse visée et le jeton de réinitialisation
 * vivent dans un cookie `httpOnly` (`lib/auth/password-reset.ts`), ce qui permet
 * aussi de reprendre à la bonne étape après un rechargement.
 *
 * Contrairement à l'inscription, aucune session n'est ouverte au bout : après
 * un changement de mot de passe, se reconnecter est la règle — et cela évite de
 * garder le nouveau mot de passe en mémoire.
 */
export function ForgotPasswordFlow({
  initialStep,
  pendingEmail,
}: ForgotPasswordFlowProps) {
  const t = useTranslations("auth.forgotPassword");
  const tSteps = useTranslations("auth.resetSteps");
  const router = useRouter();

  const [step, setStep] = useState<ForgotPasswordStep>(initialStep);
  const [email, setEmail] = useState(pendingEmail ?? "");

  const steps = [
    { key: "email", label: tSteps("email") },
    { key: "code", label: tSteps("code") },
    { key: "password", label: tSteps("password") },
  ];

  const currentIndex = step === "email" ? 0 : step === "code" ? 1 : 2;

  const handleSent = (sentTo: string) => {
    setEmail(sentTo);
    setStep("code");
  };

  const handleReset = () => {
    toast.success(t("done"));
    router.replace(`${ROUTES.login}?reset=1`);
  };

  const handleExpired = (expiredMessage: string) => {
    toast.error(expiredMessage);
    setStep("email");
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Stepper
        steps={steps}
        current={currentIndex}
        label={tSteps("label")}
        positionLabel={tSteps("position", {
          current: String(currentIndex + 1),
          total: String(steps.length),
        })}
      />

      {step === "email" ? (
        <ForgotPasswordEmailStep onSent={handleSent} />
      ) : step === "code" ? (
        <ForgotPasswordCodeStep
          email={email}
          onVerified={() => setStep("reset")}
          onRestart={() => setStep("email")}
        />
      ) : (
        <ForgotPasswordResetStep onReset={handleReset} onExpired={handleExpired} />
      )}
    </div>
  );
}
