import { render, screen, waitFor } from "@test/intl";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ImagePicker } from "./image-picker";

/**
 * Hôte minimal : le picker est contrôlé par le formulaire, qui garde le fichier
 * recadré. On reproduit ce contrat plutôt que de figer `value`.
 */
function Host({ shape = "square" }: { shape?: "square" | "wide" }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <ImagePicker
      name={shape === "square" ? "logo" : "banner"}
      label={shape === "square" ? "Logo" : "Bannière"}
      hint="Affiché dans l'application des voyageurs."
      shape={shape}
      value={file}
      onChange={setFile}
    />
  );
}

/** Dépôt d'un fichier : `fireEvent` n'expose pas de `DataTransfer` complet. */
function dropFile(zone: HTMLElement, file: File) {
  const dataTransfer = { files: [file], items: [], types: ["Files"] };
  const drop = new Event("drop", { bubbles: true });
  Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
  zone.dispatchEvent(drop);
}

describe("ImagePicker", () => {
  it("annonce le rapport imposé, différent pour un logo et une bannière", () => {
    const { unmount } = render(<Host />);
    expect(screen.getByText(/Format carré 1:1\./)).toBeInTheDocument();
    unmount();

    render(<Host shape="wide" />);
    expect(screen.getByText(/Format bannière 2:1\./)).toBeInTheDocument();
  });

  it("ouvre le recadrage sur une image déposée", async () => {
    render(<Host />);

    dropFile(
      screen.getByText(/Glissez une image ici/).closest("div[class*='border-dashed']")!,
      new File(["binaire"], "logo.png", { type: "image/png" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveTextContent("Recadrer le logo"),
    );
  });

  it("refuse un fichier hors des formats acceptés sans ouvrir le recadrage", async () => {
    render(<Host />);

    dropFile(
      screen.getByText(/Glissez une image ici/).closest("div[class*='border-dashed']")!,
      new File(["%PDF"], "contrat.pdf", { type: "application/pdf" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Format non pris en charge. Utilisez un PNG, un JPG ou un WebP.",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("referme le recadrage sans rien retenir à l'annulation", async () => {
    render(<Host />);

    dropFile(
      screen.getByText(/Glissez une image ici/).closest("div[class*='border-dashed']")!,
      new File(["binaire"], "logo.png", { type: "image/png" }),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Annuler" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Aucun fichier retenu : le bouton reste celui d'un premier choix.
    expect(
      screen.getByRole("button", { name: "Choisir un fichier" }),
    ).toBeInTheDocument();
  });
});
