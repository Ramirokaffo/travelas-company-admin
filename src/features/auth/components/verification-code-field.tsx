"use client";

import type { InputHTMLAttributes } from "react";

import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";

type VerificationCodeFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint: string;
  error?: string | undefined;
};

/**
 * Champ de saisie d'un code à six chiffres.
 *
 * Partagé par la vérification d'inscription et la réinitialisation de mot de
 * passe : les deux affichent le même code, envoyé par le même endpoint backend.
 *
 * `autocomplete="one-time-code"` permet à iOS et Android de proposer le code
 * directement depuis la notification ; `inputMode="numeric"` ouvre le pavé
 * numérique. Le crénage large sépare les chiffres à la lecture, quand on
 * recopie depuis un e-mail ouvert sur un autre appareil.
 */
export function VerificationCodeField({
  label,
  hint,
  error,
  className,
  id = "code",
  ...props
}: VerificationCodeFieldProps) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={8}
        aria-invalid={Boolean(error)}
        className={cn("h-12 text-center font-mono text-xl tracking-[0.4em]", className)}
        {...props}
      />
    </Field>
  );
}
