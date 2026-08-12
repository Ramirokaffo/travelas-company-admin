"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/select";
import { resolveIssueAction } from "@/features/incidents/actions";
import { resolveIssueSchema, type Issue } from "@/features/incidents/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

/**
 * Traitement d'un signalement.
 *
 * Deux gestes symétriques : clore avec une note, ou rouvrir. La réouverture ne
 * demande pas de confirmation — c'est l'action qui **rend** un incident visible,
 * donc sans perte possible.
 *
 * La note est facultative mais fortement souhaitable : c'est elle qui explique,
 * six mois plus tard, pourquoi le dossier a été clos. Elle est plafonnée à 500
 * caractères, la longueur de la colonne backend.
 */
export function IssueResolutionButton({ issue }: { issue: Issue }) {
  const t = useTranslations("incidents");
  const tCommon = useTranslations("common");
  const message = useTranslatedMessage();

  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(issue.resolutionNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (isResolved: boolean) => {
    const parsed = resolveIssueSchema.safeParse({
      id: issue.id,
      isResolved,
      resolutionNote: note,
    });

    if (!parsed.success) {
      setError(message(parsed.error.issues[0]?.message) ?? null);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await resolveIssueAction(parsed.data);

      if (!result.ok) {
        setError(message(result.message) ?? null);
        return;
      }

      toast.success(message(result.message));
      setOpen(false);
    });
  };

  if (issue.isResolved) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => submit(false)}
      >
        <RotateCcw className="size-4" aria-hidden />
        {t("reopen")}
      </Button>
    );
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <CheckCircle2 className="size-4" aria-hidden />
        {t("resolve")}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("resolveDialog.title")}
        description={t("resolveDialog.description")}
        dismissible={!isPending}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={() => submit(true)} disabled={isPending}>
              {isPending ? tCommon("saving") : t("resolveDialog.action")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <blockquote className="bg-subtle text-muted rounded-lg px-3 py-2 text-sm">
            {issue.description}
          </blockquote>

          <Field
            label={t("resolveDialog.note")}
            htmlFor="resolution-note"
            hint={t("resolveDialog.noteHint")}
          >
            <Textarea
              id="resolution-note"
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          {error ? <Alert variant="danger">{error}</Alert> : null}
        </div>
      </Modal>
    </>
  );
}
