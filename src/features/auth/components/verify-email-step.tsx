"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { VerificationCodeField } from "@/features/auth/components/verification-code-field";
import {
  changeEmailSchema,
  emailCodeSchema,
  type ChangeEmailInput,
  type EmailCodeInput,
} from "@/features/auth/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

/** Délai avant de pouvoir redemander un code (le backend en limite l'usage). */
const RESEND_COOLDOWN_SECONDS = 45;

type VerifyApiResponse = { message?: string; status?: string };

type VerifyEmailStepProps = {
  email: string;
  /** Appelé une fois l'adresse confirmée : le parcours prend le relais. */
  onVerified: () => void;
  onEmailChanged: (email: string) => void;
  /** Vrai pendant l'ouverture de session qui suit la vérification. */
  isFinishing: boolean;
};

/**
 * Étape 2 — vérification de l'adresse e-mail.
 *
 * Le code est saisi ici plutôt que suivi depuis le lien de l'e-mail : le lien
 * pointe vers l'API NestJS, qui redirigerait hors du dashboard. La saisie garde
 * l'utilisateur dans le parcours, et permet d'enchaîner sur l'ouverture de
 * session sans lui redemander ses identifiants.
 *
 * Le compte visé n'apparaît nulle part dans la page : le serveur le retrouve
 * dans un cookie `httpOnly` (voir `lib/auth/pending-registration.ts`).
 */
export function VerifyEmailStep({
  email,
  onVerified,
  onEmailChanged,
  isFinishing,
}: VerifyEmailStepProps) {
  const t = useTranslations("auth.verify");
  const message = useTranslatedMessage();

  const [formError, setFormError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmailCodeInput>({
    resolver: zodResolver(emailCodeSchema),
    defaultValues: { code: "" },
  });

  const emailForm = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { email: "" },
  });

  // Décompte du renvoi. Un `setTimeout` par seconde plutôt qu'un `setInterval` :
  // le nettoyage est trivial et la dérive sans conséquence à cette échelle.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const response = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => ({}))) as VerifyApiResponse;

    if (!response.ok) {
      setFormError(payload.message ?? t("errors.invalid"));
      return;
    }

    onVerified();
  });

  const handleResend = async () => {
    setFormError(null);
    setIsResending(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => ({}))) as VerifyApiResponse;

      if (!response.ok) {
        setFormError(payload.message ?? t("errors.resendFailed"));
        return;
      }

      setValue("code", "");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(t("resent"));
    } finally {
      setIsResending(false);
    }
  };

  const onChangeEmail = emailForm.handleSubmit(async (values) => {
    setFormError(null);

    const response = await fetch("/api/auth/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => ({}))) as VerifyApiResponse;

    if (!response.ok) {
      emailForm.setError("email", {
        message: payload.message ?? t("errors.changeEmailFailed"),
      });
      return;
    }

    onEmailChanged(values.email.toLowerCase());
    emailForm.reset();
    setValue("code", "");
    setIsEditingEmail(false);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    toast.success(t("resent"));
  });

  return (
    <div className="border-subtle bg-surface space-y-5 rounded-2xl border p-6 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden
          className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 flex size-12 items-center justify-center rounded-full"
        >
          <MailCheck className="size-6" />
        </span>
        <h2 className="mt-3 text-lg font-semibold">{t("title")}</h2>
        <p className="text-muted mt-1 text-sm">{t("subtitle")}</p>
        {/* L'adresse sur sa propre ligne : elle doit se relire d'un coup d'œil
            pour repérer une faute de frappe, sans être coupée sur mobile. */}
        <p className="mt-1 text-sm font-medium break-all">{email}</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <VerificationCodeField
          label={t("codeField")}
          hint={t("codeHint")}
          error={message(errors.code?.message)}
          autoFocus
          disabled={isFinishing}
          {...register("code")}
        />

        {formError ? <Alert>{formError}</Alert> : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting || isFinishing}
        >
          {isFinishing ? t("signingIn") : isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>

      <div className="border-subtle space-y-3 border-t pt-4 text-center">
        <p className="text-muted text-xs">{t("spam")}</p>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending || isFinishing}
        >
          {isResending
            ? t("resending")
            : cooldown > 0
              ? t("resendIn", { seconds: String(cooldown) })
              : t("resend")}
        </Button>

        {isEditingEmail ? (
          <form onSubmit={onChangeEmail} noValidate className="space-y-3 text-left">
            <Field
              label={t("newEmailField")}
              htmlFor="newEmail"
              error={message(emailForm.formState.errors.email?.message)}
            >
              <Input
                id="newEmail"
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-invalid={Boolean(emailForm.formState.errors.email)}
                {...emailForm.register("email")}
              />
            </Field>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setIsEditingEmail(false)}
              >
                {t("cancelEmail")}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={emailForm.formState.isSubmitting}
              >
                {t("confirmEmail")}
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingEmail(true)}
            disabled={isFinishing}
            className="text-brand-700 dark:text-brand-400 text-sm font-medium hover:underline disabled:opacity-50"
          >
            {t("changeEmail")}
          </button>
        )}
      </div>
    </div>
  );
}
