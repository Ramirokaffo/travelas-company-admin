import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: ReactNode;
  children: ReactNode;
};

/** Enveloppe accessible : libellé lié, erreur annoncée aux lecteurs d'écran. */
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-muted text-xs">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "border-subtle bg-surface h-10 w-full rounded-lg border px-3 text-sm",
        "placeholder:text-muted disabled:opacity-50",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}

type CheckboxFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
};

/**
 * Case à cocher et son libellé.
 *
 * Géométrie inverse de `Field` : le libellé suit la case au lieu de la
 * précéder, et l'ensemble est cliquable. La case reste un `<input>` natif —
 * `accent-color` suffit à la teinter, sans réimplémenter le focus ni l'état
 * indéterminé.
 */
export function CheckboxField({
  label,
  hint,
  className,
  id,
  ...props
}: CheckboxFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="flex items-center gap-2.5 text-sm">
        <input
          id={id}
          type="checkbox"
          // `brand-600` plutôt que `brand-500` : la coche est dessinée en blanc
          // par le navigateur, et l'orange vif de la charte n'y suffit pas.
          className="border-subtle accent-brand-600 size-4 rounded"
          {...props}
        />
        <span>{label}</span>
      </label>
      {hint ? <p className="text-muted pl-6.5 text-xs">{hint}</p> : null}
    </div>
  );
}
