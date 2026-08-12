import { render, screen, waitFor } from "@test/intl";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./confirm-dialog";

/**
 * Hôte minimal : `ConfirmDialog` est piloté par son parent (`open` /
 * `onOpenChange`), on reproduit donc ce contrat plutôt que de figer `open`.
 */
function Host({ onConfirm }: { onConfirm: () => void | Promise<void> }) {
  const [open, setOpen] = useState(true);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Désactiver l'agence ?"
      description="Les billets déjà vendus restent valables."
      confirmLabel="Désactiver"
      variant="danger"
      onConfirm={onConfirm}
    />
  );
}

describe("ConfirmDialog", () => {
  it("affiche l'intitulé et les conséquences de l'action", () => {
    render(<Host onConfirm={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Désactiver l'agence ?")).toBeInTheDocument();
    expect(
      screen.getByText("Les billets déjà vendus restent valables."),
    ).toBeInTheDocument();
  });

  it("exécute l'action puis referme la fenêtre", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<Host onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "Désactiver" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("n'exécute rien à l'annulation", async () => {
    const onConfirm = vi.fn();
    render(<Host onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  // Refermer sur erreur ferait disparaître le message avec la fenêtre.
  it("reste ouverte et signale l'échec sans exposer le détail technique", async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValue(new Error("ER_ROW_IS_REFERENCED: seat_id"));
    render(<Host onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "Désactiver" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("L'opération a échoué. Réessayez dans un instant.");
    expect(alert).not.toHaveTextContent("ER_ROW_IS_REFERENCED");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
