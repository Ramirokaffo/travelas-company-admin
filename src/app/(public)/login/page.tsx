import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/features/auth/components/login-form";
import { safeCallbackUrl } from "@/lib/utils/safe-url";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("login") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    // Le layout public laisse la largeur aux pages : la connexion reste sur une
    // colonne étroite.
    <div className="mx-auto max-w-md">
      <LoginForm
        callbackUrl={safeCallbackUrl(params.callbackUrl)}
        // Poser après une inscription : l'utilisateur arrive ici parce que sa
        // session n'a pas pu être ouverte automatiquement (page rechargée en
        // cours de vérification), il faut lui dire que l'étape a bien abouti.
        justVerified={params.verified === "1"}
        justReset={params.reset === "1"}
      />
    </div>
  );
}
