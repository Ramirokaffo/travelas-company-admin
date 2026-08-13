import { NextResponse } from "next/server";

/**
 * Sonde de vivacité, pour Docker et le reverse proxy.
 *
 * Volontairement muette : elle ne dit rien de la session, de l'API NestJS ni de
 * la configuration — un point d'entrée public ne doit pas servir de sonde de
 * reconnaissance. Elle prouve une seule chose, celle qui intéresse
 * l'orchestrateur : le serveur Next répond.
 *
 * Elle est exclue du `matcher` de `src/proxy.ts` — sans quoi le contrôle
 * *fail-closed* la redirigerait vers la page de connexion et le conteneur
 * serait déclaré `unhealthy` en permanence.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
