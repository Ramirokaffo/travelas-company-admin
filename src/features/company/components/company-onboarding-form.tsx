"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ROUTES } from "@/constants/routes";
import { createCompanyAction } from "@/features/company/actions";
import { ImagePicker } from "@/features/company/components/image-picker";
import { checkCompanyImage, companyFormSchema } from "@/features/company/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

type FieldErrors = { name?: string; logo?: string; banner?: string };
type Images = { logo: File | null; banner: File | null };

/**
 * Étape 3 — déclaration de l'entreprise.
 *
 * Formulaire soumis en `FormData` : `POST /company` attend du multipart (logo,
 * bannière). Un seul champ texte, non contrôlé — React Hook Form n'apporterait
 * rien ici, le schéma Zod suffit.
 *
 * Les images, elles, passent par un état : ce ne sont pas les fichiers choisis
 * mais leurs recadrages (1:1 pour le logo, 2:1 pour la bannière), produits par
 * `<ImageCropper>` et qu'aucun `<input type="file">` ne peut porter. Le
 * formulaire les pose donc lui-même dans le `FormData`.
 *
 * Les mêmes règles sont appliquées des deux côtés — `companyFormSchema` et
 * `checkCompanyImage()` sont partagés avec la Server Action, qui reste la seule
 * validation qui fasse foi.
 */
export function CompanyOnboardingForm() {
  const t = useTranslations("onboarding.form");
  const message = useTranslatedMessage();
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [images, setImages] = useState<Images>({ logo: null, banner: null });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (images.logo) formData.set("logo", images.logo);
    if (images.banner) formData.set("banner", images.banner);

    setFormError(null);

    const name = companyFormSchema.safeParse({ name: formData.get("name") });
    const logo = checkCompanyImage(formData.get("logo"));
    const banner = checkCompanyImage(formData.get("banner"));

    // Contrôle local avant l'envoi : inutile de téléverser 2 Mo pour se voir
    // refuser sur le nom, ni d'attendre le backend pour un format d'image.
    const localErrors: FieldErrors = {};
    if (!name.success) {
      localErrors.name =
        name.error.issues[0]?.message ?? "validation.companyNameRequired";
    }
    if (!logo.ok) localErrors.logo = logo.message;
    if (!banner.ok) localErrors.banner = banner.message;

    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) return;

    startTransition(async () => {
      const result = await createCompanyAction(formData);

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(message(result.message) ?? null);
        return;
      }

      toast.success(message(result.message));
      // `refresh()` recharge la session côté serveur : sans lui, le dashboard
      // serait rendu avec l'entreprise encore absente.
      router.replace(ROUTES.dashboard);
      router.refresh();
    });
  };

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="border-subtle bg-surface space-y-5 rounded-2xl border p-6 shadow-sm"
    >
      <Field
        label={t("name")}
        htmlFor="name"
        error={message(fieldErrors.name)}
        hint={t("nameHint")}
      >
        <Input
          id="name"
          name="name"
          autoComplete="organization"
          autoFocus
          maxLength={100}
          aria-invalid={Boolean(fieldErrors.name)}
          onChange={() => clearFieldError("name")}
        />
      </Field>

      <div className="border-subtle grid gap-5 border-t pt-5 sm:grid-cols-2">
        <ImagePicker
          name="logo"
          label={t("logo")}
          hint={t("logoHint")}
          error={message(fieldErrors.logo)}
          value={images.logo}
          onChange={(file) => {
            setImages((current) => ({ ...current, logo: file }));
            clearFieldError("logo");
          }}
        />
        <ImagePicker
          name="banner"
          label={t("banner")}
          hint={t("bannerHint")}
          shape="wide"
          error={message(fieldErrors.banner)}
          value={images.banner}
          onChange={(file) => {
            setImages((current) => ({ ...current, banner: file }));
            clearFieldError("banner");
          }}
        />
      </div>

      <p className="text-muted text-xs">{t("imageConstraints")}</p>

      {formError ? <Alert>{formError}</Alert> : null}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
