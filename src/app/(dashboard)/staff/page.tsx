import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { listCompanySeatOptions } from "@/features/seats/api";
import { listCompanyStaff } from "@/features/staff/api";
import { CreateStaffButton } from "@/features/staff/components/create-staff-button";
import { StaffFilters } from "@/features/staff/components/staff-filters";
import { StaffTable } from "@/features/staff/components/staff-table";
import { parseStaffFilters } from "@/features/staff/schemas";
import { parseTableQuery, toPageMeta } from "@/lib/api/data-table";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("staff") };
}

/**
 * Gestion du personnel de l'entreprise.
 *
 * `parseTableQuery` est appelé **sans `sortableColumns`** : `UserFilterDto`
 * côté NestJS est validé avec `forbidNonWhitelisted`, et n'accepte ni `orderBy`
 * ni `order`. Les transmettre ferait échouer toute la liste en 400.
 */
export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCompanySession();
  const t = await getTranslations("staff");
  const tCommon = await getTranslations("common");
  const params = await searchParams;

  const query = parseTableQuery(params);
  const filters = parseStaffFilters(params);
  const token = await getAuthorizedToken();

  const [staff, seats] = await Promise.all([
    listCompanyStaff(query, filters, token),
    listCompanySeatOptions(token),
  ]);

  const meta = toPageMeta(query, staff);
  const isFiltered = Boolean(query.search || filters.role || filters.status !== "all");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-muted mt-1 text-sm">
            {t("subtitle", {
              company: session.company.name ?? tCommon("yourCompany"),
            })}
          </p>
        </div>

        <CreateStaffButton seats={seats} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-subtle border-b">
          <StaffFilters query={query} filters={filters} />
        </div>

        <StaffTable
          members={staff.items}
          seats={seats}
          currentUserId={session.id}
          isFiltered={isFiltered}
        />

        <Pagination query={query} meta={meta} itemLabel={t("itemLabel")} />
      </Card>
    </div>
  );
}
