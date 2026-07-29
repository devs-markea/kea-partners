/**
 * Endpoint de refresco del snapshot de respaldo.
 *
 * Lee Supabase completo (`buildSnapshot`) y lo persiste en Redis
 * (`writeSnapshot`). Pensado para dispararse por **Vercel Cron** (ver
 * `vercel.json` → `crons`), aunque también puede invocarse manualmente.
 *
 * Seguridad: si existe `CRON_SECRET`, exige el header
 * `Authorization: Bearer <CRON_SECRET>`. Vercel añade ese header
 * automáticamente a las invocaciones de cron cuando la variable está definida.
 * Sin `CRON_SECRET` el endpoint queda abierto (válido solo para desarrollo).
 *
 * Si `buildSnapshot` falla NO se escribe nada: un snapshot a medias no debe
 * sobrescribir uno bueno.
 */

import type { APIRoute } from 'astro';
import { buildSnapshot } from '@/lib/supabase/backup/snapshot';
import { isBackupConfigured, writeSnapshot } from '@/lib/supabase/backup/store';

const json = (data: unknown, status: number) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

export const GET: APIRoute = async ({ request }) => {
    // ── 1. Autorización (Vercel Cron / manual) ──────────────────────────────
    const secret = import.meta.env.CRON_SECRET;
    if (secret) {
        const auth = request.headers.get('authorization');
        if (auth !== `Bearer ${secret}`) {
            return json({ ok: false, error: 'Unauthorized' }, 401);
        }
    }

    // ── 2. Redis debe estar configurado para poder escribir ─────────────────
    if (!isBackupConfigured()) {
        return json(
            { ok: false, error: 'Redis no configurado (UPSTASH_REDIS_KV_REST_API_URL).' },
            503,
        );
    }

    // ── 3. Construir el snapshot y persistirlo ──────────────────────────────
    try {
        const snapshot = await buildSnapshot();
        await writeSnapshot(snapshot);
        return json(
            {
                ok: true,
                generatedAt: snapshot.generatedAt,
                counts: snapshot.counts,
            },
            200,
        );
    } catch (error) {
        console.error('[backup/refresh] Falló el refresco del snapshot:', error);
        return json(
            { ok: false, error: error instanceof Error ? error.message : String(error) },
            500,
        );
    }
};
