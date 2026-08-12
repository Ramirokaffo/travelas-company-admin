import { getFormatter, getTranslations } from "next-intl/server";

export type RankingRow = {
  id: string;
  label: string;
  value: number;
  /** Deuxième grandeur, affichée en clair sous le libellé (billets, passagers…). */
  caption?: string;
};

type RankingBarsProps = {
  rows: RankingRow[];
  /** `true` pour formater les valeurs en monnaie. */
  currency?: boolean;
  emptyLabel?: string;
};

/**
 * Classement par barres horizontales.
 *
 * Volontairement **sans bibliothèque de graphiques** : des `<div>` de largeur
 * proportionnelle font le même travail, sans un octet de JavaScript côté
 * navigateur, et restent lisibles si le CSS ne charge pas. Le format horizontal
 * s'impose ici — les noms d'agence sont longs et se chevaucheraient sur un axe
 * vertical.
 *
 * Une seule couleur pour toutes les barres : les agences n'ont pas d'ordre
 * naturel, et un dégradé « plus foncé = plus grand » ré-encoderait en teinte ce
 * que la longueur dit déjà.
 *
 * Chaque valeur est **étiquetée en clair** à droite : la longueur situe, le
 * chiffre tranche — et le lecteur n'a jamais à estimer une barre à l'œil.
 */
export async function RankingBars({
  rows,
  currency = false,
  emptyLabel,
}: RankingBarsProps) {
  const t = await getTranslations("analytics");
  const format = await getFormatter();

  if (rows.length === 0) {
    return (
      <p className="text-muted py-8 text-center text-sm">{emptyLabel ?? t("noData")}</p>
    );
  }

  // L'échelle part du maximum affiché, pas de zéro : sur des agences dont les
  // recettes sont proches, une échelle absolue les rendrait indistinctes.
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.label}</p>
              {row.caption ? (
                <p className="text-muted truncate text-xs">{row.caption}</p>
              ) : null}
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums">
              {/* Pas de format nommé pour un nombre simple : next-intl signale
                  un format inconnu et retombe sur le défaut. Omettre l'argument
                  demande exactement ce défaut. */}
              {currency
                ? format.number(row.value, "currency")
                : format.number(row.value)}
            </p>
          </div>

          {/* Piste et barre : `aria-hidden` car la valeur exacte est déjà
              annoncée juste au-dessus, en texte. */}
          <div
            className="bg-subtle h-2 w-full overflow-hidden rounded-full"
            aria-hidden
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((Math.abs(row.value) / max) * 100, row.value === 0 ? 0 : 2)}%`,
                background: "var(--chart-1)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
