import { Skeleton, StatsSkeleton } from "@/components/ui/skeleton";

/** Attente des statistiques : rangée de KPI puis zone de graphiques. */
export default function StatisticsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <StatsSkeleton />

      <Skeleton className="h-80 w-full rounded-2xl" />

      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}
