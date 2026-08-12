import { Skeleton, StatsSkeleton } from "@/components/ui/skeleton";

/** Attente de la vue d'ensemble : rangée de KPI puis zone de graphiques. */
export default function DashboardOverviewLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <StatsSkeleton />

      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}
