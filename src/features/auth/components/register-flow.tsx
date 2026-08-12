"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Stepper } from "@/components/ui/stepper";
import { ROUTES } from "@/constants/routes";
import { RegisterAccountStep } from "@/features/auth/components/register-account-step";
import { VerifyEmailStep } from "@/features/auth/components/verify-email-step";

export type RegisterStep = "account" | "verify";

type RegisterFlowProps = {
  /** Étape d'entrée, décidée côté serveur d'après l'inscription en attente. */
  initialStep: RegisterStep;
  pendingEmail: string | null;
};

/**
 * Parcours d'inscription : compte → vérification de l'e-mail → entreprise.
 *
 * Les deux premières étapes tiennent dans **une seule page**, sans navigation.
 * C'est ce qui permet d'enchaîner sur l'espace de travail sans redemander ses
 * identifiants : le mot de passe reste dans une `ref` du temps de la
 * vérification, jamais écrit dans un stockage persistant ni dans le DOM, et il
 * est effacé dès la session ouverte.
 *
 * La troisième étape (`/onboarding`) est une page à part : elle exige une
 * session, et le formulaire d'entreprise vit derrière `requireSession()`.
 *
 * Si la page est rechargée pendant la vérification, l'étape est retrouvée grâce
 * au cookie d'inscription en attente — mais plus le mot de passe. On bascule
 * alors sur la connexion classique, qui n'est qu'un écran de plus.
 */
export function RegisterFlow({ initialStep, pendingEmail }: RegisterFlowProps) {
  const t = useTranslations("auth.steps");
  const router = useRouter();

  const [step, setStep] = useState<RegisterStep>(initialStep);
  const [email, setEmail] = useState(pendingEmail ?? "");
  const [isFinishing, setIsFinishing] = useState(false);

  const password = useRef<string | null>(null);

  const steps = [
    { key: "account", label: t("account") },
    { key: "verification", label: t("verification") },
    { key: "company", label: t("company") },
  ];

  const currentIndex = step === "account" ? 0 : 1;

  const handleRegistered = (credentials: { email: string; password: string }) => {
    password.current = credentials.password;
    setEmail(credentials.email);
    setStep("verify");
  };

  /**
   * Ouvre la session juste après la vérification, puis passe à l'onboarding.
   *
   * L'appel passe par le même route handler que le formulaire de connexion :
   * il n'existe qu'un seul endroit où une session peut naître, avec son contrôle
   * de rôle et ses cookies `httpOnly`.
   */
  const handleVerified = async () => {
    setIsFinishing(true);

    const secret = password.current;
    password.current = null;

    if (!secret) {
      router.replace(`${ROUTES.login}?verified=1`);
      return;
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ login: email, password: secret }),
    });

    if (!response.ok) {
      router.replace(`${ROUTES.login}?verified=1`);
      return;
    }

    // `refresh()` force le re-rendu serveur : sans lui, l'onboarding serait
    // rendu avec la session absente d'avant la connexion.
    router.replace(ROUTES.onboarding);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Stepper
        steps={steps}
        current={currentIndex}
        label={t("label")}
        positionLabel={t("position", {
          current: String(currentIndex + 1),
          total: String(steps.length),
        })}
      />

      {step === "account" ? (
        <RegisterAccountStep onRegistered={handleRegistered} />
      ) : (
        <VerifyEmailStep
          email={email}
          onVerified={handleVerified}
          onEmailChanged={setEmail}
          isFinishing={isFinishing}
        />
      )}
    </div>
  );
}
