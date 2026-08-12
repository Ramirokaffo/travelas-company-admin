"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { LoginStatus } from "@/constants/auth-status";
import { ROUTES } from "@/constants/routes";
import {
  loginSchema,
  strongPasswordSchema,
  type LoginInput,
} from "@/features/auth/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

type LoginApiResponse = {
  status?: string;
  message?: string;
  /** Le compte existe mais son e-mail n'a jamais été vérifié. */
  canResumeVerification?: boolean;
};

export function LoginForm({
  callbackUrl,
  justVerified = false,
  justReset = false,
}: {
  callbackUrl: string;
  /** L'e-mail vient d'être vérifié : on confirme avant de demander à nouveau. */
  justVerified?: boolean;
  /** Le mot de passe vient d'être réinitialisé. */
  justReset?: boolean;
}) {
  const t = useTranslations("auth");
  const message = useTranslatedMessage();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  /** Le backend peut exiger une rotation du mot de passe à la connexion. */
  const [mustRotatePassword, setMustRotatePassword] = useState(false);
  /**
   * Compte jamais vérifié : sans reprise possible, l'utilisateur est bloqué —
   * il ne peut ni se connecter, ni se réinscrire (téléphone et identifiant déjà
   * pris). Le route handler a rouvert le parcours, il ne reste qu'à l'y mener.
   */
  const [pendingVerification, setPendingVerification] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setPendingVerification(false);

    if (mustRotatePassword) {
      const check = strongPasswordSchema.safeParse(values.newPassword ?? "");
      if (!check.success) {
        setError("newPassword", {
          message: check.error.issues[0]?.message ?? "validation.passwordWeak",
        });
        return;
      }
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Same-origin : les cookies httpOnly sont posés par le route handler.
      credentials: "same-origin",
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => ({}))) as LoginApiResponse;

    if (payload.status === LoginStatus.NEED_PASSWORD_UPDATE) {
      setMustRotatePassword(true);
      setFormError(payload.message ?? null);
      return;
    }

    if (!response.ok) {
      setFormError(payload.message ?? t("errors.failed"));
      setPendingVerification(Boolean(payload.canResumeVerification));
      return;
    }

    // `refresh()` force le re-rendu serveur pour que la session fraîchement
    // créée soit lue par les layouts protégés.
    router.replace(callbackUrl);
    router.refresh();
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="border-subtle bg-surface space-y-5 rounded-2xl border p-6 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold">{t("loginTitle")}</h2>
        <p className="text-muted mt-1 text-sm">{t("loginSubtitle")}</p>
      </div>

      {justVerified ? (
        <Alert variant="success">{t("verify.verifiedNotice")}</Alert>
      ) : null}

      {justReset ? (
        <Alert variant="success">{t("forgotPassword.resetNotice")}</Alert>
      ) : null}

      <Field
        label={t("loginField")}
        htmlFor="login"
        error={message(errors.login?.message)}
      >
        <Input
          id="login"
          type="text"
          autoComplete="username"
          autoFocus
          aria-invalid={Boolean(errors.login)}
          {...register("login")}
        />
      </Field>

      <Field
        label={t("passwordField")}
        htmlFor="password"
        error={message(errors.password?.message)}
      >
        <PasswordInput
          id="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
      </Field>

      {/* Hors du `Field` : son `hint` s'efface dès qu'une erreur s'affiche,
          c'est-à-dire précisément quand ce lien devient utile. */}
      <p className="-mt-3 text-right text-sm">
        <Link
          href={ROUTES.forgotPassword}
          className="text-brand-700 dark:text-brand-400 font-medium hover:underline"
        >
          {t("forgotPassword.link")}
        </Link>
      </p>

      {mustRotatePassword ? (
        <Field
          label={t("newPasswordField")}
          htmlFor="newPassword"
          error={message(errors.newPassword?.message)}
          hint={t("newPasswordHint")}
        >
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.newPassword)}
            {...register("newPassword")}
          />
        </Field>
      ) : null}

      {formError ? (
        pendingVerification ? (
          // Message d'échec doublé d'une sortie : le parcours de vérification
          // a été rouvert côté serveur, `/register` reprendra à la saisie du
          // code, avec le renvoi et la correction d'adresse.
          <Alert variant="info">
            <p>{formError}</p>
            <Link
              href={ROUTES.register}
              className="mt-2 inline-block font-medium underline"
            >
              {t("resumeVerification")}
            </Link>
          </Alert>
        ) : (
          <Alert>{formError}</Alert>
        )
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>

      <p className="text-muted text-center text-sm">
        {t("noAccount")}{" "}
        <Link
          href={ROUTES.register}
          className="text-brand-700 dark:text-brand-400 font-medium hover:underline"
        >
          {t("createCompany")}
        </Link>
      </p>
    </form>
  );
}
