import { Building2 } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils/cn";

type CompanyLogoProps = {
  /** URL du logo côté stockage, `null` tant qu'aucun logo n'a été téléversé. */
  src: string | null;
  /** Côté du carré, en pixels. */
  size?: number;
  className?: string;
};

/**
 * Logo de l'entreprise, en carré, avec repli sur une icône.
 *
 * Purement décoratif (`alt=""`) : il accompagne toujours le nom de
 * l'entreprise, en clair ou en infobulle. Le doubler d'un texte alternatif
 * ferait annoncer deux fois la même information.
 *
 * `unoptimized` pour la même raison que sur la fiche entreprise : l'hôte de
 * stockage n'est pas toujours celui déclaré dans `next.config.ts` selon
 * l'environnement, et un échec d'optimisation afficherait une image cassée.
 */
export function CompanyLogo({ src, size = 36, className }: CompanyLogoProps) {
  return (
    <span
      className={cn(
        "border-subtle bg-surface relative block shrink-0 overflow-hidden rounded-lg border",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt="" fill unoptimized className="object-cover" />
      ) : (
        <span className="text-muted flex size-full items-center justify-center">
          <Building2
            style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5) }}
            aria-hidden
          />
        </span>
      )}
    </span>
  );
}
