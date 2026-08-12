"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ROUTES } from "@/constants/routes";

/**
 * Déconnexion.
 *
 * Passe par `/api/auth/logout`, qui invalide le token côté backend
 * (`isLoggedOut = true`) puis efface les cookies : effacer les cookies seuls
 * laisserait un token valable 30 jours dans la nature.
 *
 * Confirmation obligatoire : le bouton voisine les sélecteurs de langue et de
 * thème dans la barre supérieure, et se déconnecter coûte une ressaisie
 * complète des identifiants — un clic de trop ne doit pas suffire. C'est
 * `ConfirmDialog` qui porte l'état d'attente et l'échec, la fenêtre restant
 * ouverte tant que la déconnexion n'a pas abouti.
 */
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("topbar");
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleLogout = async () => {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });

    // `ConfirmDialog` transforme cette exception en message dans la fenêtre :
    // l'utilisateur reste sur place, toujours connecté, et peut réessayer.
    if (!response.ok) throw new Error("Échec de la déconnexion");

    router.replace(ROUTES.login);
    router.refresh();
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsConfirming(true)}
        aria-label={t("logout")}
      >
        <LogOut className="size-4" aria-hidden />
        <span className={compact ? "hidden md:inline" : ""}>{t("logout")}</span>
      </Button>

      <ConfirmDialog
        open={isConfirming}
        onOpenChange={setIsConfirming}
        title={t("logoutConfirmTitle")}
        description={t("logoutConfirmDescription")}
        confirmLabel={t("logout")}
        errorMessage={t("logoutFailed")}
        onConfirm={handleLogout}
      />
    </>
  );
}
