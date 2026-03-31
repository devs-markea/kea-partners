/**
 * In-memory rate limiter.
 *
 * IMPORTANTE — Vercel (serverless): cada instancia de función tiene su propio
 * proceso, por lo que el conteo NO se comparte entre instancias en paralelo.
 * Para un rate limit estricto en producción, reemplazar con Upstash Redis o
 * Vercel KV usando el mismo contrato de la función `checkRateLimit`.
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

/**
 * @param key          - Identificador único (ej. IP del cliente)
 * @param maxRequests  - Máximo de peticiones permitidas en la ventana
 * @param windowMinutes - Duración de la ventana en minutos
 */
export function checkRateLimit(
    key: string,
    maxRequests: number,
    windowMinutes: number
): RateLimitResult {
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
    }

    if (entry.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}
