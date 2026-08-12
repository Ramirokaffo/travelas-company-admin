import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Actions principales de la page (bouton de création, export…). */
  actions?: ReactNode;
};

/**
 * En-tête de page.
 *
 * Un seul `<h1>` par page, toujours au même endroit et à la même taille : c'est
 * ce que suit la navigation au clavier comme celle d'un lecteur d'écran. Les
 * actions passent en dessous sur mobile plutôt que de comprimer le titre.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description ? <p className="text-muted mt-1 text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
