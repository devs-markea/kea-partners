/**
 * Rate limiter con soporte para Upstash Redis (producción/Vercel) y fallback en memoria (local).
 *
 * En Vercel, el conteo se comparte entre todas las instancias serverless
 * gracias a Upstash Redis. En desarrollo local se usa un Map en memoria.
 *
 * Variables de entorno requeridas en Vercel (se configuran automáticamente
 * al vincular Upstash Redis desde el Marketplace de Vercel):
 *   UPSTASH_REDIS_KV_REST_API_URL   — URL del endpoint REST de Upstash
 *   UPSTASH_REDIS_KV_REST_API_TOKEN — Token de autenticación
 */

import { Redis } from '@upstash/redis';

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

// ── Upstash Redis (producción / Vercel) ─────────────────────────────────────

const useRedis = !!import.meta.env.UPSTASH_REDIS_KV_REST_API_URL;

const redis = useRedis
    ? new Redis({
          url:   import.meta.env.UPSTASH_REDIS_KV_REST_API_URL,
          token: import.meta.env.UPSTASH_REDIS_KV_REST_API_TOKEN,
      })
    : null;

async function checkRateLimitRedis(
    key: string,
    maxRequests: number,
    windowMinutes: number,
): Promise<RateLimitResult> {
    const rlKey = `rl:${key}`;
    const windowSeconds = windowMinutes * 60;

    // INCR atómico + TTL solo en la primera creación
    const count = await redis!.incr(rlKey);

    if (count === 1) {
        await redis!.expire(rlKey, windowSeconds);
    }

    const ttl = await redis!.ttl(rlKey);
    const resetAt = Date.now() + ttl * 1000;

    if (count > maxRequests) {
        return { allowed: false, remaining: 0, resetAt };
    }

    return { allowed: true, remaining: maxRequests - count, resetAt };
}

// ── In-memory fallback (desarrollo local) ───────────────────────────────────

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function checkRateLimitMemory(
    key: string,
    maxRequests: number,
    windowMinutes: number,
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

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * @param key          - Identificador único (ej. `login:<ip>`)
 * @param maxRequests  - Máximo de peticiones permitidas en la ventana
 * @param windowMinutes - Duración de la ventana en minutos
 */
export function checkRateLimit(
    key: string,
    maxRequests: number,
    windowMinutes: number,
): Promise<RateLimitResult> | RateLimitResult {
    if (useRedis && redis) {
        return checkRateLimitRedis(key, maxRequests, windowMinutes);
    }
    return checkRateLimitMemory(key, maxRequests, windowMinutes);
}
