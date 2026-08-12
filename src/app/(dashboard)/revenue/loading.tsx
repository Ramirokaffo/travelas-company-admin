import { Card } from "@/components/ui/card";
import { Skeleton, StatsSkeleton, TableSkeleton } from "@/components/ui/skeleton";

/** Attente des recettes : en-tête, rangée de totaux, tableau. */
export default function RevenueLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      <StatsSkeleton />

      <Card className="overflow-hidden">
        <TableSkeleton rows={6} columns={6} />
      </Card>
    </div>
  );
}
