"use client";

import { Crop, ImagePlus, X } from "lucide-react";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { ImageCropper } from "@/components/ui/image-cropper";
import {
  ACCEPTED_IMAGE_ACCEPT_ATTRIBUTE,
  MAX_IMAGE_BYTES,
  isAcceptedImageType,
} from "@/features/company/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";
import { cn } from "@/lib/utils/cn";

type ImagePickerProps = {
  /** Nom du champ posté — `logo` ou `banner` côté backend. */
  name: "logo" | "banner";
  label: string;
  hint: string;
  error?: string | undefined;
  /** `square` impose un recadrage 1:1, `wide` un 2:1. */
  shape?: "square" | "wide";
  /** Image recadrée retenue, `null` tant qu'aucune n'a été validée. */
  value: File | null;
  onChange: (file: File | null) => void;
};

/** Rapport et largeur de sortie par forme. Un logo n'a pas besoin d'être large. */
const SHAPES = {
  square: { aspect: 1, maxWidth: 1024, ratioKey: "imageRatioSquare" },
  wide: { aspect: 2, maxWidth: 1600, ratioKey: "imageRatioWide" },
} as const;

/**
 * Sélecteur d'image : glisser-déposer, recadrage au rapport imposé, aperçu.
 *
 * Le fichier ne vient plus de l'`<input type="file">` — il en sort recadré par
 * `<ImageCropper>`, donc sous la forme d'un nouveau `File` qu'aucun input ne
 * peut porter (leur `files` est en lecture seule hors `DataTransfer`, dont le
 * support est inégal). Le champ n'a donc pas d'attribut `name` : il ne sert
 * qu'à ouvrir le sélecteur de fichiers, et c'est le formulaire qui pose la
 * valeur dans son `FormData`.
 *
 * L'aperçu passe par `URL.createObjectURL` (autorisé par la CSP, qui accepte
 * `blob:` en `img-src`) et l'URL est révoquée dès qu'elle change : sans cela,
 * chaque essai laisserait une image en mémoire pour la durée de la page.
 */
export function ImagePicker({
  name,
  label,
  hint,
  error,
  shape = "square",
  value,
  onChange,
}: ImagePickerProps) {
  const t = useTranslations("onboarding.form");
  const message = useTranslatedMessage();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  /** Image d'origine en attente de recadrage. */
  const [pending, setPending] = useState<File | null>(null);
  // L'original est conservé pour que « Recadrer » reparte de la pleine
  // définition : recadrer un recadrage cumulerait les pertes de réencodage.
  const [original, setOriginal] = useState<File | null>(null);

  const { aspect, maxWidth, ratioKey } = SHAPES[shape];

  // L'URL est dérivée du fichier plutôt que posée par un effet : elle doit
  // exister au premier rendu de l'aperçu, sinon la vignette apparaît vide le
  // temps d'un tour de boucle.
  const preview = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  /** Ouvre le recadrage sur un fichier choisi, déposé ou remplacé. */
  const handleSelect = (file: File | undefined) => {
    // Le champ est remis à zéro pour que le même fichier, choisi deux fois de
    // suite après une annulation, redéclenche bien un `change`.
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    if (!isAcceptedImageType(file)) {
      setTypeError("onboarding.actions.imageType");
      return;
    }

    setTypeError(null);
    setOriginal(file);
    setPending(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleSelect(event.dataTransfer.files[0]);
  };

  const handleClear = () => {
    setTypeError(null);
    setOriginal(null);
    onChange(null);
  };

  const visibleError = error ?? message(typeError ?? undefined);

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>

      <div
        onDragOver={(event) => {
          // Sans ce `preventDefault`, le navigateur refuse le dépôt et ouvre
          // l'image dans l'onglet.
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          // `dragleave` remonte aussi des enfants : sans ce contrôle, passer
          // au-dessus du bouton éteindrait la surbrillance.
          const next = event.relatedTarget as Node | null;
          if (!next || !event.currentTarget.contains(next)) setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "rounded-xl border border-dashed p-3 transition-colors",
          isDragging ? "border-brand-500 bg-brand-50" : "border-subtle bg-background",
        )}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            // Nom distinct de celui du bouton voisin : deux commandes qui
            // mènent au même endroit ne doivent pas s'annoncer pareil.
            aria-label={t("imageZone")}
            className={cn(
              "bg-surface border-subtle flex shrink-0 items-center justify-center overflow-hidden rounded-lg border",
              "focus-visible:ring-brand-500 outline-none focus-visible:ring-2",
              shape === "square" ? "size-20" : "h-20 w-40",
            )}
          >
            {preview ? (
              // Image locale et éphémère : `next/image` n'y apporterait rien
              // (aucune optimisation possible sur un `blob:`).
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-full object-cover" />
            ) : (
              <ImagePlus className="text-muted size-6" aria-hidden />
            )}
          </button>

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                {t(value ? "imageReplace" : "imagePick")}
              </Button>

              {value && original ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPending(original)}
                >
                  <Crop className="size-4" aria-hidden />
                  {t("imageRecrop")}
                </Button>
              ) : null}

              {value ? (
                <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                  <X className="size-4" aria-hidden />
                  {t("imageRemove")}
                </Button>
              ) : null}
            </div>

            <p className="text-muted text-xs">
              {hint} {t(ratioKey)}
            </p>
            <p className="text-muted text-xs">{t("imageDropHint")}</p>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        id={name}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT_ATTRIBUTE}
        className="sr-only"
        aria-label={label}
        aria-invalid={Boolean(visibleError)}
        onChange={(event) => handleSelect(event.target.files?.[0])}
      />

      {visibleError ? (
        <p role="alert" className="text-danger text-xs">
          {visibleError}
        </p>
      ) : null}

      <ImageCropper
        open={pending !== null}
        file={pending}
        aspect={aspect}
        maxWidth={maxWidth}
        maxBytes={MAX_IMAGE_BYTES}
        title={t(shape === "square" ? "cropLogo" : "cropBanner")}
        onCancel={() => setPending(null)}
        onCropped={(file) => {
          setPending(null);
          onChange(file);
        }}
      />
    </div>
  );
}
