import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Chaque test repart d'un DOM propre : sans cela, deux rendus successifs du
// même composant font échouer les requêtes `getBy*` pour cause de doublon.
afterEach(() => {
  cleanup();
});

/**
 * jsdom n'implémente pas les URLs d'objet.
 *
 * Les aperçus d'image (`features/company/components/image-picker`,
 * `components/ui/image-cropper`) reposent dessus. Un compteur suffit : rien ne
 * décode l'image dans jsdom, les tests n'observent que l'aiguillage.
 */
if (typeof URL.createObjectURL !== "function") {
  let objectUrlCount = 0;
  URL.createObjectURL = () => `blob:travelas/${++objectUrlCount}`;
  URL.revokeObjectURL = () => {};
}

/**
 * jsdom n'implémente pas encore l'API modale de `<dialog>`.
 *
 * `components/ui/modal.tsx` s'appuie dessus (piège de focus, fond inerte,
 * fermeture par Échap). On reproduit ici le strict minimum observable depuis un
 * test : l'attribut `open` et l'évènement `close`. Le piège de focus, lui,
 * reste du ressort du navigateur — il n'est donc pas couvert par ces tests.
 */
if (
  typeof HTMLDialogElement !== "undefined" &&
  typeof HTMLDialogElement.prototype.showModal !== "function"
) {
  const openDialog = function (this: HTMLDialogElement) {
    this.open = true;
  };

  HTMLDialogElement.prototype.show = openDialog;
  HTMLDialogElement.prototype.showModal = openDialog;
  HTMLDialogElement.prototype.close = function (
    this: HTMLDialogElement,
    value?: string,
  ) {
    if (value !== undefined) this.returnValue = value;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
