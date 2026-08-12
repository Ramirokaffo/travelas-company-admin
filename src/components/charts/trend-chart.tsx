"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SeriesPoint } from "@/features/analytics/schemas";

export type TrendSeries = {
  /** Identifiant stable : c'est lui qui fixe la couleur, pas le rang d'affichage. */
  key: string;
  label: string;
  points: SeriesPoint[];
  /** Emplacement de couleur, de 1 à 3. Attribué par la grandeur mesurée. */
  slot: 1 | 2 | 3;
  /** `true` pour formater en monnaie plutôt qu'en nombre simple. */
  currency?: boolean;
};

type TrendChartProps = {
  series: TrendSeries[];
  height?: number;
};

type Row = { date: string } & Record<string, number | string>;

/**
 * Évolution dans le temps.
 *
 * Aire empilée non — **superposée** : les séries représentent des grandeurs
 * comparables (recette, part plateforme) sur **un seul axe**. Jamais deux
 * échelles verticales : leur alignement serait arbitraire et inventerait une
 * corrélation absente des données.
 *
 * Les couleurs viennent des jetons `--chart-N` de `globals.css`, vérifiés au
 * validateur de la compétence dataviz sur les deux thèmes. Elles sont lues en
 * `var()` directement par le SVG : la bascule clair/sombre est donc gratuite,
 * sans re-rendu React ni lecture du contexte de thème.
 *
 * Aucun point n'est dessiné au repos (une série journalière sur un an en
 * compterait 365) : le survol en fait apparaître un seul, cerclé de la couleur
 * de surface pour rester lisible au croisement des courbes.
 */
export function TrendChart({ series, height = 260 }: TrendChartProps) {
  const t = useTranslations("analytics");
  const format = useFormatter();
  // Les identifiants de dégradé sont globaux au document : deux graphiques sur
  // la même page se voleraient leur remplissage sans ce préfixe unique.
  const gradientId = useId().replace(/:/g, "");

  const first = series[0];
  if (!first || first.points.length === 0) {
    return (
      <p className="text-muted flex items-center justify-center py-16 text-sm">
        {t("noData")}
      </p>
    );
  }

  // Toutes les séries partagent l'axe des dates : on assemble une ligne par
  // date, avec une colonne par série.
  const rows: Row[] = first.points.map((point, index) => {
    const row: Row = { date: point.date };
    for (const entry of series) {
      row[entry.key] = entry.points[index]?.value ?? 0;
    }
    return row;
  });

  const isCurrency = series.some((entry) => entry.currency);

  const formatAxisValue = (value: number) =>
    format.number(value, isCurrency ? "compactCurrency" : "compact");

  const formatDay = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : format.dateTime(date, "day");
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {series.map((entry) => (
              <linearGradient
                key={entry.key}
                id={`${gradientId}-${entry.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                {/* Lavis à ~10 % : l'aire situe la courbe, elle ne la remplace pas. */}
                <stop
                  offset="0%"
                  stopColor={`var(--chart-${entry.slot})`}
                  stopOpacity={0.16}
                />
                <stop
                  offset="100%"
                  stopColor={`var(--chart-${entry.slot})`}
                  stopOpacity={0}
                />
              </linearGradient>
            ))}
          </defs>

          {/* Grille en retrait : un trait plein d'un cran au-dessus du fond. */}
          <CartesianGrid stroke="var(--subtle)" strokeWidth={1} vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={formatDay}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--subtle)" }}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={formatAxisValue}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />

          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
            // Fonction de rendu et non élément : recharts injecte ses propres
            // props (`active`, `label`, `payload`) dans l'élément qu'on lui
            // passe, ce que TypeScript ne peut pas exprimer sans les déclarer
            // toutes. La fonction ne prend que celles dont on se sert.
            content={({ active, label }) => (
              <TrendTooltip
                active={Boolean(active)}
                label={label}
                series={series}
                formatDay={formatDay}
              />
            )}
          />

          {series.map((entry) => (
            <Area
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              name={entry.label}
              stroke={`var(--chart-${entry.slot})`}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={`url(#${gradientId}-${entry.key})`}
              // Le point n'apparaît qu'au survol, avec un anneau de la couleur
              // de surface : il reste lisible là où deux courbes se croisent.
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: "var(--surface)",
                fill: `var(--chart-${entry.slot})`,
              }}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Infobulle.
 *
 * Réécrite plutôt que reprise de recharts : le rendu par défaut ignore les
 * jetons de thème et formate les nombres sans monnaie ni séparateur de
 * milliers.
 */
function TrendTooltip({
  active,
  label,
  series,
  formatDay,
}: {
  active: boolean;
  label: string | number | undefined;
  series: TrendSeries[];
  formatDay: (value: string) => string;
}) {
  const format = useFormatter();

  if (!active || typeof label !== "string") return null;

  const row = series.map((entry) => ({
    entry,
    value: entry.points.find((point) => point.date === label)?.value ?? 0,
  }));

  return (
    <div className="border-subtle bg-surface rounded-xl border px-3 py-2 text-xs shadow-lg">
      <p className="text-muted mb-1.5 font-medium">{formatDay(label)}</p>
      <ul className="space-y-1">
        {row.map(({ entry, value }) => (
          <li key={entry.key} className="flex items-center gap-2">
            {/* L'identité passe par la pastille colorée, jamais par la couleur
                du texte : les teintes claires sont illisibles en typographie. */}
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: `var(--chart-${entry.slot})` }}
            />
            <span className="text-muted">{entry.label}</span>
            <span className="ml-auto font-medium tabular-nums">
              {entry.currency ? format.number(value, "currency") : format.number(value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
