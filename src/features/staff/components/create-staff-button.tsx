"use client";

import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { SeatOption } from "@/features/seats/schemas";
import { StaffFormDialog } from "@/features/staff/components/staff-form-dialog";

/** Bouton d'ajout et sa fenêtre — le seul état client de l'en-tête de page. */
export function CreateStaffButton({ seats }: { seats: SeatOption[] }) {
  const t = useTranslations("staff");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" aria-hidden />
        {t("create")}
      </Button>

      <StaffFormDialog open={open} onOpenChange={setOpen} seats={seats} member={null} />
    </>
  );
}
