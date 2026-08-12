import "server-only";

/**
 * Limiteur de débit en mémoire (fenêtre glissante fixe).
 *
 * Objectif : ralentir le bourrage d'identifiants sur `/api/auth/login` avant
 * même d'atteindre le backend (qui bloque le compte après
 * `MAX_LOGIN_FAIL_COUNT` échecs — un attaquant peut donc verrouiller un compte
 * tiers ; on limite d'abord par IP).
 *
 * LIMITE CONNUE : l'état est local au processus. En production multi-instance,
 * remplacer l'implémentation par Redis (voir PLAN.md, phase « Durcissement »).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Purge paresseuse : évite une croissance illimitée de la Map. */
function sweep(now: number): void {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Secondes avant réinitialisation du quota. */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  bucket.count += 1;
  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter,
  };
}

/**
 * Identifie l'appelant pour le quota.
 *
 * `x-forwarded-for` est falsifiable si l'application n'est pas derrière un
 * proxy de confiance : ne jamais s'en servir pour une décision d'autorisation,
 * uniquement pour du throttling.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  return ip ?? "unknown";
}
