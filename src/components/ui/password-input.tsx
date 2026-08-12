"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";

/**
 * Champ de mot de passe avec bascule d'affichage.
 *
 * Sur un formulaire d'inscription, la faute de frappe silencieuse est la
 * première cause d'échec : pouvoir relire ce qu'on a saisi vaut mieux que
 * multiplier les champs de confirmation. Le bouton est un `<button>` réel,
 * atteignable au clavier, et son état est annoncé par `aria-pressed`.
 */
export function PasswordInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const t = useTranslations("common");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-pressed={visible}
        aria-label={t(visible ? "hidePassword" : "showPassword")}
        className="text-muted hover:text-foreground absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
