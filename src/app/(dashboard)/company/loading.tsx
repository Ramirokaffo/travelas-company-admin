import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Attente de la fiche entreprise : bannière, identité, formulaire. */
export default function CompanyLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Card className="overflow-hidden">
        <Skeleton className="h-32 w-full rounded-none sm:h-40" />
        <div className="flex gap-4 px-5 py-4">
          <Skeleton className="size-20 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </Card>
    </div>
  );
}
