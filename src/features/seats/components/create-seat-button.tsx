"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { AgencyOption } from "@/features/agencies/schemas";
import { SeatFormDialog } from "@/features/seats/components/seat-form-dialog";

/** Bouton d'ajout et sa fenêtre — le seul état client de l'en-tête de page. */
export function CreateSeatButton({ agencies }: { agencies: AgencyOption[] }) {
  const t = useTranslations("seats");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {t("create")}
      </Button>

      <SeatFormDialog
        open={open}
        onOpenChange={setOpen}
        agencies={agencies}
        seat={null}
      />
    </>
  );
}
