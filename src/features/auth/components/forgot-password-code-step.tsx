"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { VerificationCodeField } from "@/features/auth/components/verification-code-field";
import { emailCodeSchema, type EmailCodeInput } from "@/features/auth/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

/** Délai avant de pouvoir redemander un code — le backend en limite l'usage. */
const RESEND_COOLDOWN_SECONDS = 45;

type ForgotPasswordCodeStepProps = {
  email: string;
  onVerified: () => void;
  /** Revient à la saisie de l'adresse, code en main perdu. */
  onRestart: () => void;
};

/**
 * Étape 2 — le code reçu par e-mail.
 *
 * Sa validation ne renvoie rien au navigateur : le jeton de réinitialisation
 * délivré par le backend est rangé côté serveur, dans le cookie `httpOnly` du
 * parcours. Le formulaire suivant n'a donc aucun secret à transporter.
 */
export function ForgotPasswordCodeStep({
  email,
  onVerified,
  onRestart,
}: ForgotPasswordCodeStepProps) {
  const t = useTranslations("auth.forgotPassword");
  const message = useTranslatedMessage();

  const [formError, setFormError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmailCodeInput>({
    resolver: zodResolver(emailCodeSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const response = await fetch("/api/auth/forgot-password/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (!response.ok) {
      setFormError(payload.message ?? t("errors.invalidCode"));
      return;
    }

    onVerified();
  });

  // Le renvoi passe par le même point d'entrée que la demande initiale : une
  // seule route, un seul quota, et l'adresse est déjà connue du serveur.
  const handleResend = async () => {
    setFormError(null);
    setIsResending(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setFormError(payload.message ?? t("errors.failed"));
        return;
      }

      setValue("code", "");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(t("resent"));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="border-subtle bg-surface space-y-5 rounded-2xl border p-6 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden
          className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 flex size-12 items-center justify-center rounded-full"
        >
          <MailCheck className="size-6" />
        </span>
        <h2 className="mt-3 text-lg font-semibold">{t("codeTitle")}</h2>
        <p className="text-muted mt-1 text-sm">{t("codeSubtitle")}</p>
        <p className="mt-1 text-sm font-medium break-all">{email}</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <VerificationCodeField
          label={t("codeField")}
          hint={t("codeHint")}
          error={message(errors.code?.message)}
          autoFocus
          {...register("code")}
        />

        {formError ? <Alert>{formError}</Alert> : null}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t("verifying") : t("verify")}
        </Button>
      </form>

      <div className="border-subtle space-y-3 border-t pt-4 text-center">
        <p className="text-muted text-xs">{t("spam")}</p>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
        >
          {isResending
            ? t("resending")
            : cooldown > 0
              ? t("resendIn", { seconds: String(cooldown) })
              : t("resend")}
        </Button>

        <button
          type="button"
          onClick={onRestart}
          className="text-brand-700 dark:text-brand-400 block w-full text-sm font-medium hover:underline"
        >
          {t("changeEmail")}
        </button>
      </div>
    </div>
  );
}
