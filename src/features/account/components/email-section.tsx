"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, MailWarning } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import {
  cancelEmailChangeAction,
  confirmEmailChangeAction,
  requestEmailChangeAction,
} from "@/features/account/actions";
import {
  emailChangeCodeSchema,
  emailChangeFormSchema,
  type EmailChangeCodeValues,
  type EmailChangeFormValues,
} from "@/features/account/schemas";
import { VerificationCodeField } from "@/features/auth/components/verification-code-field";
import { useTranslatedMessage } from "@/lib/i18n/message";
import type { SessionUser } from "@/types/user";

/**
 * Adresse e-mail du compte, et son changement.
 *
 * Le parcours est en deux temps, et c'est ce qui le rend sûr :
 *
 *  1. **Demande** — mot de passe + nouvelle adresse. Le backend range celle-ci
 *     dans `pendingEmail` et lui envoie un code à six chiffres. L'adresse
 *     actuelle ne bouge pas : la connexion, la récupération de mot de passe et
 *     les notifications continuent de passer par elle.
 *  2. **Preuve** — le code saisi ici installe la nouvelle adresse.
 *
 * Avant ce parcours, `PATCH /user { email }` remplaçait l'adresse sans rien
 * vérifier, `isEmailVerify` restant à `true` : le compte ressortait « vérifié »
 * sur une boîte que personne n'avait prouvée. Le backend refuse désormais ce
 * chemin (voir le §6 octies de PLAN.md).
 */
export function EmailSection({ user }: { user: SessionUser }) {
  const t = useTranslations("settings.email");
  const tCommon = useTranslations("common");
  const message = useTranslatedMessage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  /**
   * L'affichage bascule sur l'état « en attente » — ou en sort — selon
   * `user.pendingEmail`, qui vient de la session relue côté serveur. Les
   * actions revalident déjà l'arbre ; ce rafraîchissement explicite garantit
   * que la bascule a bien lieu dans la foulée, plutôt qu'au prochain
   * chargement complet.
   */
  const refresh = () => router.refresh();

  const requestForm = useForm<EmailChangeFormValues>({
    resolver: zodResolver(emailChangeFormSchema),
    defaultValues: { newEmail: "", currentPassword: "" },
  });

  const codeForm = useForm<EmailChangeCodeValues>({
    resolver: zodResolver(emailChangeCodeSchema),
    defaultValues: { code: "" },
  });

  const onRequest = requestForm.handleSubmit((values) => {
    startTransition(async () => {
      const result = await requestEmailChangeAction(values);

      if (!result.ok) {
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          requestForm.setError(field as keyof EmailChangeFormValues, {
            message: key,
          });
        }
        requestForm.setError("root", { message: result.message });
        return;
      }

      toast.success(message(result.message));
      // Le mot de passe ne survit pas à la demande.
      requestForm.reset({ newEmail: "", currentPassword: "" });
      refresh();
    });
  });

  const onConfirm = codeForm.handleSubmit((values) => {
    startTransition(async () => {
      const result = await confirmEmailChangeAction(values);

      if (!result.ok) {
        codeForm.setError("code", {
          message: result.fieldErrors?.code ?? result.message,
        });
        return;
      }

      toast.success(message(result.message));
      codeForm.reset({ code: "" });
      refresh();
    });
  });

  const onCancel = () => {
    startTransition(async () => {
      const result = await cancelEmailChangeAction();

      if (!result.ok) {
        codeForm.setError("code", { message: result.message });
        return;
      }

      toast.success(message(result.message));
      codeForm.reset({ code: "" });
      refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-subtle bg-subtle/50 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2.5">
        {user.isEmailVerify ? (
          <MailCheck className="text-success size-4 shrink-0" aria-hidden />
        ) : (
          <MailWarning className="text-warning size-4 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {user.email ?? tCommon("none")}
        </span>
        {user.isEmailVerify ? (
          <Badge variant="success">{t("verified")}</Badge>
        ) : (
          <Badge variant="warning">{t("unverified")}</Badge>
        )}
      </div>

      {user.pendingEmail ? (
        /* Changement en cours : c'est la preuve qui manque, pas l'adresse. On
           n'affiche donc pas le formulaire de demande — une seconde demande
           annulerait le code déjà envoyé sans que l'utilisateur comprenne
           pourquoi. Pour viser une autre adresse : « Annuler », puis
           recommencer. */
        <form onSubmit={onConfirm} noValidate className="space-y-4">
          <Alert variant="info">
            {t.rich("pendingNotice", {
              email: user.pendingEmail,
              strong: (chunks) => <strong className="font-medium">{chunks}</strong>,
            })}
          </Alert>

          <VerificationCodeField
            id="account-email-code"
            label={t("codeLabel")}
            hint={t("codeHint")}
            error={message(codeForm.formState.errors.code?.message)}
            disabled={isPending}
            {...codeForm.register("code")}
          />

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={onCancel}
            >
              {t("cancelChange")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? tCommon("working") : t("confirm")}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={onRequest} noValidate className="space-y-5">
          <p className="text-muted text-sm">{t("description")}</p>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t("newEmail")}
              htmlFor="account-new-email"
              error={message(requestForm.formState.errors.newEmail?.message)}
            >
              <Input
                id="account-new-email"
                type="email"
                autoComplete="email"
                maxLength={50}
                aria-invalid={Boolean(requestForm.formState.errors.newEmail)}
                {...requestForm.register("newEmail")}
              />
            </Field>

            <Field
              label={t("currentPassword")}
              htmlFor="account-email-password"
              hint={t("currentPasswordHint")}
              error={message(requestForm.formState.errors.currentPassword?.message)}
            >
              <PasswordInput
                id="account-email-password"
                autoComplete="current-password"
                maxLength={128}
                aria-invalid={Boolean(requestForm.formState.errors.currentPassword)}
                {...requestForm.register("currentPassword")}
              />
            </Field>
          </div>

          {requestForm.formState.errors.root ? (
            <Alert variant="danger">
              {message(requestForm.formState.errors.root.message)}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? tCommon("working") : t("submit")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
