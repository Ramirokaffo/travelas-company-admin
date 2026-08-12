import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Primitives de tableau.
 *
 * Le tableau défile horizontalement dans son propre conteneur : sur mobile, une
 * liste de billets ou de collaborateurs dépasse toujours la largeur d'écran, et
 * on ne veut pas que ce soit la page entière qui parte de travers.
 */
export function TableWrapper({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />;
}

export function Table({
  className,
  caption,
  children,
  ...props
}: HTMLAttributes<HTMLTableElement> & { caption?: string }) {
  return (
    <TableWrapper>
      <table className={cn("w-full border-collapse text-sm", className)} {...props}>
        {/* Décrit le contenu aux lecteurs d'écran sans occuper l'espace visuel. */}
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </TableWrapper>
  );
}

export function THead({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-subtle text-muted border-b text-left", className)}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-subtle divide-y", className)} {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("hover:bg-subtle/40 transition-colors", className)} {...props} />
  );
}

export function TH({
  className,
  align = "left",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap uppercase",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  align = "left",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

/** Ligne unique occupant toute la largeur — état vide ou message d'erreur. */
export function TableMessageRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10">
        {children}
      </td>
    </tr>
  );
}
