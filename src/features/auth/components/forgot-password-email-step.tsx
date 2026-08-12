"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ROUTES } from "@/constants/routes";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

type ForgotPasswordEmailStepProps = {
  onSent: (email: string) => void;
};

/**
 * Étape 1 — l'adresse du compte.
 *
 * La réponse du serveur est identique que le compte existe ou non : on passe
 * donc toujours à l'étape suivante. Le distinguer permettrait d'énumérer les
 * comptes du dashboard, et c'est aussi ce que fait déjà le formulaire de
 * connexion en donnant le même message pour deux causes d'échec.
 */
export function ForgotPasswordEmailStep({ onSent }: ForgotPasswordEmailStepProps) {
  const t = useTranslations("auth.forgotPassword");
  const message = useTranslatedMessage();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (!response.ok) {
      setFormError(payload.message ?? t("errors.failed"));
      return;
    }

    onSent(values.email.toLowerCase());
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
          <KeyRound className="size-6" />
        </span>
        <h2 className="mt-3 text-lg font-semibold">{t("title")}</h2>
        <p className="text-muted mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <Field
        label={t("emailField")}
        htmlFor="email"
        error={message(errors.email?.message)}
        hint={t("emailHint")}
      >
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </Field>

      {formError ? <Alert>{formError}</Alert> : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t("sending") : t("send")}
      </Button>

      <p className="text-muted border-subtle border-t pt-4 text-center text-sm">
        <Link
          href={ROUTES.login}
          className="text-brand-700 dark:text-brand-400 font-medium hover:underline"
        >
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}
