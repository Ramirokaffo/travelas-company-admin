import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/** Conteneur de section. Server Component : aucune interactivité. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-subtle bg-surface rounded-2xl border", className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  action,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { action?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-5 py-4",
        // La bordure n'apparaît que si un contenu suit.
        "border-subtle [&:not(:last-child)]:border-b",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 space-y-1">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-sm font-semibold", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-muted text-sm", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-subtle flex items-center justify-end gap-2 border-t px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}
