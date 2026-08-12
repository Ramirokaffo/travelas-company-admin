import { Card } from "@/components/ui/card";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

/** Attente d'une liste : en-tête, barre de filtres, tableau. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-subtle flex gap-3 border-b px-4 py-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
        <TableSkeleton rows={6} columns={5} />
      </Card>
    </div>
  );
}
