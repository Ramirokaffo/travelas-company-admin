import { useTranslations } from "next-intl";
import Image from "next/image";

import { cn } from "@/lib/utils/cn";

/**
 * Logos de la suite Travelas (marque produit) et de Novatech (maison mère).
 *
 * Chaque logo existe en deux déclinaisons. Les deux sont rendues et c'est le
 * CSS qui masque celle qui ne correspond pas au thème : le composant reste
 * ainsi utilisable dans un Server Component, sans `"use client"` ni bascule
 * après hydratation.
 */
const BRANDS = {
  travelas: {
    altKey: "travelasLogo",
    light: "/logo/travelas/logo-travelas-light-mode.png",
    dark: "/logo/travelas/logo-travelas-dark-mode.png",
    ratio: 140 / 40,
  },
  novatech: {
    altKey: "novatechLogo",
    light: "/logo/novatech/logo-novatech-light-mode.png",
    dark: "/logo/novatech/logo-novatech-dark-mode.png",
    ratio: 120 / 30,
  },
} as const;

export type BrandLogoProps = {
  brand?: keyof typeof BRANDS;
  /** Hauteur de rendu en pixels ; la largeur suit le ratio du fichier. */
  height?: number;
  className?: string;
  /** `true` pour un logo purement décoratif, doublé par un texte adjacent. */
  decorative?: boolean;
  priority?: boolean;
};

export function BrandLogo({
  brand = "travelas",
  height = 32,
  className,
  decorative = false,
  priority = false,
}: BrandLogoProps) {
  const t = useTranslations("brand");
  const { altKey, light, dark, ratio } = BRANDS[brand];
  const width = Math.round(height * ratio);
  const alt = decorative ? "" : t(altKey);

  return (
    <span
      className={cn("inline-flex shrink-0 items-center", className)}
      style={{ height }}
      aria-hidden={decorative || undefined}
    >
      {/* `style` redit ce que disent déjà `h-full w-auto` : next/image compare
          les dimensions intrinsèques aux styles *en ligne* et avertit dès qu'un
          seul des deux côtés semble contraint. Les classes seules ne le
          rassurent pas. */}
      <Image
        src={light}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        style={{ height: "100%", width: "auto" }}
        className="dark:hidden"
      />
      <Image
        src={dark}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        style={{ height: "100%", width: "auto" }}
        className="hidden dark:block"
      />
    </span>
  );
}
