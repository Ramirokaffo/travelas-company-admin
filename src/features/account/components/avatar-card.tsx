"use client";

import { ImagePlus, Trash2, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ImageCropper } from "@/components/ui/image-cropper";
import { removeAvatarAction, updateAvatarAction } from "@/features/account/actions";
import {
  ACCEPTED_AVATAR_ACCEPT_ATTRIBUTE,
  MAX_AVATAR_BYTES,
  isAcceptedAvatarType,
} from "@/features/account/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";
import type { SessionUser } from "@/types/user";

/**
 * Photo de profil.
 *
 * Elle a sa propre route côté backend (`POST /auth/profile/image`, champ
 * `image`) : elle est donc envoyée dès que le recadrage est validé, sans
 * bouton « Enregistrer ». Un fichier facultatif mêlé au formulaire d'identité
 * aurait imposé de tout poster en multipart pour rien.
 *
 * ⚠️ `allowWebp={false}` : cette route valide les types avec
 * `/^image\/(jpeg|jpg|ico|png)$/i`. Un WebP y reviendrait en 400 après le
 * téléversement complet.
 */
export function AvatarCard({ user }: { user: SessionUser }) {
  const t = useTranslations("settings.avatar");
  const tCommon = useTranslations("common");
  const message = useTranslatedMessage();

  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /** Image d'origine en attente de recadrage. */
  const [pending, setPending] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // L'aperçu passe par une URL d'objet, révoquée dès qu'elle change : sans
  // cela, chaque essai laisserait une image en mémoire pour la durée de la
  // page.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const current = preview ?? user.profilImage;

  const onSelect = (file: File | undefined) => {
    setError(null);
    if (!file) return;

    if (!isAcceptedAvatarType(file)) {
      setError("settings.actions.imageType");
      return;
    }

    setPending(file);
  };

  const onCropped = (file: File) => {
    setPending(null);

    const formData = new FormData();
    formData.append("image", file);

    startTransition(async () => {
      const result = await updateAvatarAction(formData);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      // Aperçu immédiat : le backend renvoie l'URL du fichier, mais la session
      // n'est relue qu'au prochain rendu serveur.
      setPreview((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(file);
      });
      toast.success(message(result.message));
    });
  };

  const onRemove = () => {
    setError(null);
    startTransition(async () => {
      const result = await removeAvatarAction();

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setPreview((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      toast.success(message(result.message));
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="border-subtle bg-subtle relative size-20 shrink-0 overflow-hidden rounded-full border">
          {current ? (
            // `unoptimized` : l'hôte de stockage varie selon l'environnement et
            // n'est pas toujours celui déclaré dans `next.config.ts`.
            <Image src={current} alt="" fill unoptimized className="object-cover" />
          ) : (
            <span className="text-muted flex size-full items-center justify-center">
              <UserRound className="size-8" aria-hidden />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium">{fullName}</p>
          <p className="text-muted text-xs">{t("hint")}</p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden />
            {t(current ? "replace" : "add")}
          </Button>

          {current ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={onRemove}
            >
              <Trash2 className="size-4" aria-hidden />
              <span className="sr-only">{t("remove")}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Le fichier posté est celui que produit le recadreur, pas celui de
          l'input : ce champ ne sert qu'à ouvrir le sélecteur, il n'a donc pas
          de `name`. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_AVATAR_ACCEPT_ATTRIBUTE}
        className="sr-only"
        aria-label={t("add")}
        onChange={(event) => {
          onSelect(event.target.files?.[0]);
          // Permet de resélectionner le même fichier après annulation.
          event.target.value = "";
        }}
      />

      {isPending ? <p className="text-muted text-xs">{tCommon("working")}</p> : null}
      {error ? <Alert variant="danger">{message(error)}</Alert> : null}

      <ImageCropper
        open={pending !== null}
        file={pending}
        aspect={1}
        maxWidth={512}
        maxBytes={MAX_AVATAR_BYTES}
        allowWebp={false}
        title={t("cropTitle")}
        onCancel={() => setPending(null)}
        onCropped={onCropped}
      />
    </div>
  );
}
