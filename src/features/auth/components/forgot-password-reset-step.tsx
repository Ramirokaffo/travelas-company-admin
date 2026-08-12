"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordChecklist } from "@/features/auth/components/password-checklist";
import { resetPasswordSchema, type ResetPasswordInput } from "@/features/auth/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

type ForgotPasswordResetStepProps = {
  /** Le parcours est terminé : à l'appelant d'emmener vers la connexion. */
  onReset: () => void;
  /** Le jeton n'est plus valable : il faut redemander un code. */
  onExpired: (message: string) => void;
};

/**
 * Étape 3 — le nouveau mot de passe.
 *
 * Aucun jeton ne transite ici : le serveur retrouve celui de l'étape
 * précédente dans son cookie `httpOnly`. Les règles affichées sont celles de
 * `strongPasswordSchema`, appliquées des deux côtés.
 */
export function ForgotPasswordResetStep({
  onReset,
  onExpired,
}: ForgotPasswordResetStepProps) {
  const t = useTranslations("auth.forgotPassword");
  const message = useTranslatedMessage();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = useWatch({ control, name: "password" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const response = await fetch("/api/auth/forgot-password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (!response.ok) {
      // 409 : le jeton de réinitialisation a expiré ou a déjà servi. Rester sur
      // ce formulaire n'aboutirait plus, on renvoie à la demande de code.
      if (response.status === 409) {
        onExpired(payload.message ?? t("errors.expiredSession"));
        return;
      }

      setFormError(payload.message ?? t("errors.failed"));
      return;
    }

    onReset();
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="border-subtle bg-surface space-y-5 rounded-2xl border p-6 shadow-sm"
    >
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden
          className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 flex size-12 items-center justify-center rounded-full"
        >
          <ShieldCheck className="size-6" />
        </span>
        <h2 className="mt-3 text-lg font-semibold">{t("resetTitle")}</h2>
        <p className="text-muted mt-1 text-sm">{t("resetSubtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("newPassword")}
          htmlFor="password"
          error={message(errors.password?.message)}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
        </Field>

        <Field
          label={t("confirmPassword")}
          htmlFor="confirmPassword"
          error={message(errors.confirmPassword?.message)}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
        </Field>

        <div className="sm:col-span-2">
          <PasswordChecklist value={password} />
        </div>
      </div>

      {formError ? <Alert>{formError}</Alert> : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t("resetting") : t("reset")}
      </Button>
    </form>
  );
}
