import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ROUTES } from "@/constants/routes";

/**
 * Bandeau « entreprise pas encore activée ».
 *
 * La conséquence est invisible depuis le dashboard : tant que Travelas n'a pas
 * activé l'entreprise, les trajets créés ici n'apparaissent pas dans
 * l'application mobile des voyageurs. Sans ce rappel permanent, un chef
 * d'entreprise remplit son catalogue et attend des réservations qui ne peuvent
 * pas arriver.
 *
 * `role="status"` et non `alert` : l'information est importante mais
 * persistante, elle ne doit pas interrompre le lecteur d'écran à chaque
 * navigation. La couleur ne porte rien seule — le texte dit tout.
 *
 * Le texte n'est jamais en `text-warning` : l'ambre de la charte tombe sous
 * 4,5:1 sur fond clair. Seule l'icône est teintée, le texte reste en
 * `foreground`.
 */
export async function CompanyInactiveBanner() {
  const t = await getTranslations("company.inactiveBanner");

  return (
    <div
      role="status"
      className="bg-warning/10 border-warning/30 flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-3 text-sm"
    >
      <AlertTriangle className="text-warning size-4 shrink-0" aria-hidden />
      <p className="font-semibold">{t("title")}</p>
      <p className="min-w-0 flex-1">{t("description")}</p>
      <Link
        href={ROUTES.company}
        className="focus-visible:outline-brand-500 shrink-0 font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {t("link")}
      </Link>
    </div>
  );
}
