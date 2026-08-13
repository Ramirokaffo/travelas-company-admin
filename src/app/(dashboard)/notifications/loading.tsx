import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Squelette du centre de notification, calé sur la liste réelle. */
export default function NotificationsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-subtle border-b p-4">
          <Skeleton className="h-9 w-full max-w-md" />
        </div>
        <ul className="divide-subtle divide-y">
          {Array.from({ length: 6 }).map((_, index) => (
            <li key={index} className="space-y-2 px-5 py-4">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-80" />
              <Skeleton className="h-3 w-32" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
