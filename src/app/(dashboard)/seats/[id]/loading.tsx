import { Card } from "@/components/ui/card";
import { Skeleton, StatsSkeleton, TableSkeleton } from "@/components/ui/skeleton";

/** Attente de la fiche d'agence : identité, totaux, recettes et contacts. */
export default function SeatDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />

      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <StatsSkeleton />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <TableSkeleton rows={5} columns={6} />
        </Card>
        <Card className="space-y-3 p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      </div>
    </div>
  );
}
