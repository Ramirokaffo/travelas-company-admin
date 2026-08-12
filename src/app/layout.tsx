import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { Providers } from "@/app/providers";
import { publicEnv } from "@/lib/config/public-env";
import { THEME_COOKIE, parseTheme, themeClassName } from "@/lib/theme/theme";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    title: {
      default: publicEnv.appName,
      template: `%s · ${publicEnv.appName}`,
    },
    description: t("description"),
    // Un back-office ne doit jamais être indexé.
    robots: { index: false, follow: false, nocache: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Layout racine.
 *
 * Langue et thème sont résolus **sur le serveur**, à partir de cookies : le
 * HTML part déjà dans la bonne langue et le bon thème, sans script de
 * pré-hydratation ni écran qui clignote au chargement. C'est aussi ce qui évite
 * d'avoir à faire passer un script inline par le nonce CSP.
 *
 * Le nonce n'est donc pas manipulé ici : `src/proxy.ts` pose l'en-tête
 * `Content-Security-Policy` sur la requête, et Next.js en extrait
 * automatiquement le nonce pour ses propres scripts d'hydratation. Un éventuel
 * script inline maison devrait lire l'en-tête `x-nonce` via `headers()`.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang={locale}
      // « Système » ne pose aucune classe : c'est `prefers-color-scheme` qui
      // tranche alors, côté CSS comme côté variante Tailwind.
      className={`${geistSans.variable} ${geistMono.variable} ${themeClassName(theme) ?? ""} h-full antialiased`}
      // Le sélecteur de thème modifie cette classe avant l'hydratation de React,
      // pour un retour visuel immédiat : sans cette tolérance, React signalerait
      // une divergence entre le HTML servi et le DOM courant.
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {/* Rendu depuis un Server Component, le provider hérite seul de la
            langue, des messages et du fuseau définis dans `i18n/request.ts`. */}
        <NextIntlClientProvider>
          <Providers theme={theme}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
