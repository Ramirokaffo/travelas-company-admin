import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableMessageRow,
} from "@/components/ui/table";
import { UserRole } from "@/constants/roles";
import type { SeatOption } from "@/features/seats/schemas";
import { StaffRowActions } from "@/features/staff/components/staff-row-actions";
import type { StaffMember } from "@/features/staff/schemas";

type StaffTableProps = {
  members: StaffMember[];
  seats: SeatOption[];
  currentUserId: string;
  /** `true` si un filtre est actif : change le message d'état vide. */
  isFiltered: boolean;
};

const ROLE_BADGE: Partial<Record<UserRole, "brand" | "neutral">> = {
  [UserRole.AGENCY_ADMIN]: "brand",
};

/** Server Component : seules les actions de ligne sont interactives. */
export async function StaffTable({
  members,
  seats,
  currentUserId,
  isFiltered,
}: StaffTableProps) {
  const t = await getTranslations("staff");
  const tCommon = await getTranslations("common");
  const tRoles = await getTranslations("roles");
  const tSeats = await getTranslations("seats");

  return (
    <Table caption={t("tableCaption")}>
      <THead>
        <TR>
          <TH>{t("columns.member")}</TH>
          <TH>{t("columns.role")}</TH>
          <TH>{t("columns.seat")}</TH>
          <TH>{t("columns.status")}</TH>
          <TH align="right">
            <span className="sr-only">{tCommon("actions")}</span>
          </TH>
        </TR>
      </THead>

      <TBody>
        {members.length === 0 ? (
          <TableMessageRow colSpan={5}>
            <EmptyState
              icon={Users}
              title={t(isFiltered ? "empty.filteredTitle" : "empty.title")}
              description={t(
                isFiltered ? "empty.filteredDescription" : "empty.description",
              )}
            />
          </TableMessageRow>
        ) : (
          members.map((member) => (
            <TR key={member.id}>
              <TD>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {member.fullName}
                    {member.id === currentUserId ? (
                      <span className="text-muted font-normal"> {t("you")}</span>
                    ) : null}
                  </p>
                  <p className="text-muted truncate text-xs">
                    {member.email ?? member.phoneNumber ?? member.userName}
                  </p>
                </div>
              </TD>

              <TD>
                <Badge variant={ROLE_BADGE[member.role] ?? "neutral"}>
                  {tRoles(member.role)}
                </Badge>
              </TD>

              <TD>
                {member.seat ? (
                  <span className="truncate">
                    {member.seat.name ?? tSeats("unnamed")}
                  </span>
                ) : (
                  <span className="text-muted">{t("unassigned")}</span>
                )}
              </TD>

              <TD>
                {member.isBlocked ? (
                  <Badge variant="danger">{t("statusValues.blocked")}</Badge>
                ) : member.isActive ? (
                  <Badge variant="success">{t("statusValues.active")}</Badge>
                ) : (
                  <Badge variant="warning">{t("statusValues.inactive")}</Badge>
                )}
              </TD>

              <TD align="right">
                <StaffRowActions
                  member={member}
                  seats={seats}
                  isSelf={member.id === currentUserId}
                />
              </TD>
            </TR>
          ))
        )}
      </TBody>
    </Table>
  );
}
