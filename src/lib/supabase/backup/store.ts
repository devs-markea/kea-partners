/**
 * Almacén del snapshot de respaldo en Upstash Redis.
 *
 * Reutiliza la integración Upstash que ya usa el rate-limiter
 * (`src/lib/rate-limiter.ts`) — mismas variables de entorno, configuradas
 * automáticamente al vincular Upstash Redis desde el Marketplace de Vercel:
 *   UPSTASH_REDIS_KV_REST_API_URL    — endpoint REST
 *   UPSTASH_REDIS_KV_REST_API_TOKEN  — token
 *
 * El snapshot NO expira: un respaldo viejo es mejor que ninguno cuando Supabase
 * está caído. La frescura se juzga por `generatedAt`, no por TTL. El cron de
 * refresco (`/api/backup/refresh`) sobrescribe la key periódicamente.
 *
 * ⚠️ SOLO SERVIDOR.
 */

import { Redis } from '@upstash/redis';
import { SNAPSHOT_VERSION, isBackupSnapshot, type BackupSnapshot } from './types';

const redisUrl = import.meta.env.UPSTASH_REDIS_KV_REST_API_URL;
const redisToken = import.meta.env.UPSTASH_REDIS_KV_REST_API_TOKEN;

const redis = redisUrl
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

/**
 * Key del snapshot en Redis. Lleva la versión del formato: al subir
 * `SNAPSHOT_VERSION` se escribe en una key nueva y la vieja queda ignorada
 * (un lector de la versión nueva nunca lee la vieja).
 */
const SNAPSHOT_KEY = `backup:snapshot:v${SNAPSHOT_VERSION}`;

/** ¿Hay Redis configurado? El refresco lo necesita; el lector lo tolera ausente. */
export function isBackupConfigured(): boolean {
    return redis !== null;
}

/**
 * Persiste el snapshot en Redis. Lanza si Redis no está configurado o si la
 * escritura falla — el cron debe enterarse del fallo (no escribir en silencio).
 */
export async function writeSnapshot(snapshot: BackupSnapshot): Promise<void> {
    if (!redis) {
        throw new Error(
            '[backup] Redis no configurado: define UPSTASH_REDIS_KV_REST_API_URL ' +
            'y UPSTASH_REDIS_KV_REST_API_TOKEN.',
        );
    }
    // El SDK de Upstash serializa el objeto a JSON automáticamente.
    await redis.set(SNAPSHOT_KEY, snapshot);
}

/**
 * Lee el snapshot de Redis. Devuelve `null` —nunca lanza— si Redis no está
 * configurado, si no hay snapshot, si la lectura falla o si el contenido es
 * inválido / de otra versión. El lector de respaldo debe degradar con gracia,
 * no romperse.
 */
export async function readSnapshot(): Promise<BackupSnapshot | null> {
    if (!redis) return null;

    try {
        // Upstash deserializa JSON automáticamente; por robustez se contempla
        // también recibir el string crudo.
        const value = await redis.get<unknown>(SNAPSHOT_KEY);
        if (value === null || value === undefined) return null;

        const parsed = typeof value === 'string' ? safeParse(value) : value;
        if (!isBackupSnapshot(parsed)) {
            console.warn(
                '[backup] El snapshot en Redis es inválido o de otra versión; se ignora.',
            );
            return null;
        }
        return parsed;
    } catch (error) {
        console.error('[backup] No se pudo leer el snapshot de Redis:', error);
        return null;
    }
}

/** `JSON.parse` que devuelve `null` en vez de lanzar ante un string corrupto. */
function safeParse(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}
