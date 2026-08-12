"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { ROUTES } from "@/constants/routes";
import { PasswordChecklist } from "@/features/auth/components/password-checklist";
import { registerSchema, type RegisterInput } from "@/features/auth/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

type RegisterApiResponse = {
  message?: string;
  fieldErrors?: Partial<Record<keyof RegisterInput, string>>;
};

type RegisterAccountStepProps = {
  /** Remonte les identifiants au parcours, qui s'en sert après vérification. */
  onRegistered: (credentials: { email: string; password: string }) => void;
};

/**
 * Étape 1 — création du compte administrateur.
 *
 * Le formulaire est validé par `registerSchema`, le même schéma que le route
 * handler : la validation ici est un confort, celle du serveur est la garantie.
 * Les erreurs de doublon (e-mail, téléphone, identifiant) reviennent du backend
 * rattachées à leur champ, pour ne pas obliger à relire tout le formulaire.
 */
export function RegisterAccountStep({ onRegistered }: RegisterAccountStepProps) {
  const t = useTranslations("auth.register");
  const message = useTranslatedMessage();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      lastName: "",
      userName: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    },
  });

  // `useWatch` plutôt que `watch()` : il s'abonne au champ sans re-rendre tout
  // le formulaire à chaque frappe — et c'est l'API que React Hook Form
  // recommande dans un composant.
  const password = useWatch({ control, name: "password" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => ({}))) as RegisterApiResponse;

    if (!response.ok) {
      for (const [field, fieldMessage] of Object.entries(payload.fieldErrors ?? {})) {
        setError(field as keyof RegisterInput, { message: fieldMessage });
      }
      setFormError(payload.message ?? t("errors.failed"));
      return;
    }

    onRegistered({
      email: values.email.toLowerCase(),
      password: values.password,
    });
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="border-subtle bg-surface space-y-5 rounded-2xl border p-6 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-muted mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("firstName")}
          htmlFor="firstName"
          error={message(errors.firstName?.message)}
        >
          <Input
            id="firstName"
            autoComplete="given-name"
            autoFocus
            aria-invalid={Boolean(errors.firstName)}
            {...register("firstName")}
          />
        </Field>

        <Field
          label={t("lastName")}
          htmlFor="lastName"
          error={message(errors.lastName?.message)}
        >
          <Input
            id="lastName"
            autoComplete="family-name"
            aria-invalid={Boolean(errors.lastName)}
            {...register("lastName")}
          />
        </Field>

        <Field
          label={t("email")}
          htmlFor="email"
          error={message(errors.email?.message)}
          hint={t("emailHint")}
        >
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <Field
          label={t("phone")}
          htmlFor="phoneNumber"
          error={message(errors.phoneNumber?.message)}
          hint={t("phoneHint")}
        >
          <Input
            id="phoneNumber"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+2250700000000"
            aria-invalid={Boolean(errors.phoneNumber)}
            {...register("phoneNumber")}
          />
        </Field>

        <Field
          label={t("userName")}
          htmlFor="userName"
          error={message(errors.userName?.message)}
          hint={t("userNameHint")}
        >
          <Input
            id="userName"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(errors.userName)}
            {...register("userName")}
          />
        </Field>
      </div>

      <div className="border-subtle grid gap-4 border-t pt-5 sm:grid-cols-2">
        <Field
          label={t("password")}
          htmlFor="password"
          error={message(errors.password?.message)}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
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

      <div className="space-y-3">
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
        <p className="text-muted text-xs">{t("legal")}</p>
      </div>

      <p className="text-muted border-subtle border-t pt-4 text-center text-sm">
        {t("haveAccount")}{" "}
        <Link
          href={ROUTES.login}
          className="text-brand-700 dark:text-brand-400 font-medium hover:underline"
        >
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
