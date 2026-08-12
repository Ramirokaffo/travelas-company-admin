"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import { ThemeProvider, useTheme } from "@/lib/theme/theme-context";
import type { Theme } from "@/lib/theme/theme";

/**
 * Sonner rend ses notifications hors de l'arbre CSS de la page : la classe
 * `.dark` de `<html>` ne l'atteint pas, il faut lui passer le thème. Composant
 * séparé car il consomme le contexte que `Providers` vient d'installer, et doit
 * donc se re-rendre à chaque bascule.
 */
function AppToaster() {
  const { theme } = useTheme();
  return <Toaster position="top-right" richColors closeButton theme={theme} />;
}

/**
 * Providers client de l'application.
 *
 * Le `QueryClient` est créé dans un `useState` : une instance par rendu
 * navigateur. Un client déclaré au niveau module serait partagé entre les
 * rendus SSR, donc entre utilisateurs — fuite de données inter-comptes.
 *
 * `NextIntlClientProvider` n'est pas ici mais dans le layout racine : rendu
 * depuis un Server Component, il hérite seul de la configuration de langue.
 */
export function Providers({ theme, children }: { theme: Theme; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Ne pas réessayer une erreur d'autorisation : c'est définitif.
            retry: (failureCount, error) => {
              const status = (error as { status?: number }).status;
              if (status === 401 || status === 403) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <ThemeProvider initialTheme={theme}>
      <QueryClientProvider client={queryClient}>
        {children}
        <AppToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
