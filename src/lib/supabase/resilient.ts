/**
 * Fachada resiliente de los intermediarios de Supabase.
 *
 * Cada función intenta primero la fuente en vivo (Supabase) y, SOLO si esa
 * consulta lanza (servicio caído / inaccesible), cae al snapshot de respaldo en
 * Redis, reproduciendo en memoria la misma consulta (ver `backup/query.ts`).
 *
 * Importante:
 *   - El fallback se activa ante un ERROR, no ante un resultado vacío o `null`.
 *     Un registro genuinamente ausente en Supabase (borrado, no publicado) NO
 *     se resucita desde el respaldo.
 *   - Si no hay snapshot disponible, se propaga el error original: el llamador
 *     (las páginas) ya lo captura con `.catch` y cae a su respaldo legacy JSON.
 *   - El builder del snapshot (`backup/snapshot.ts`) usa los intermediarios
 *     CRUDOS, no esta fachada, para no reescribir el respaldo con datos viejos
 *     si Supabase falla durante el refresco.
 *
 * Las páginas deben importar desde aquí en vez de los módulos crudos. La firma
 * de cada función es idéntica a la del intermediario que envuelve.
 *
 * ⚠️ SOLO SERVIDOR.
 */

import {
    getBrandedResidenceBySlug as rawGetBrandedResidenceBySlug,
    getBrandedResidences as rawGetBrandedResidences,
    type BrandedResidenceQuery,
} from './branded-residences';
import {
    getDestinationBySlug as rawGetDestinationBySlug,
    getDestinations as rawGetDestinations,
    type DestinationInclude,
    type DestinationQuery,
} from './destinations';
import {
    getDevelopmentBySlug as rawGetDevelopmentBySlug,
    getDevelopments as rawGetDevelopments,
    type DevelopmentInclude,
    type DevelopmentQuery,
} from './developments';
import { readSnapshot } from './backup/store';
import {
    queryBrandedResidenceBySlug,
    queryBrandedResidences,
    queryDestinationBySlug,
    queryDestinations,
    queryDevelopmentBySlug,
    queryDevelopments,
} from './backup/query';
import type { BackupData } from './backup/types';
import type { BrandedResidence, Destination, Development, Language } from './types';

/** Lee los datos del snapshot, o `null` si no hay respaldo disponible. */
async function snapshotData(): Promise<BackupData | null> {
    const snapshot = await readSnapshot();
    return snapshot?.data ?? null;
}

function warnFallback(ctx: string, error: unknown): void {
    console.warn(
        `[supabase/resilient] ${ctx}: Supabase falló; sirviendo desde el respaldo (Redis).`,
        error instanceof Error ? error.message : error,
    );
}

// ── destinations ─────────────────────────────────────────────────────────────

export async function getDestinations(query: DestinationQuery = {}): Promise<Destination[]> {
    try {
        return await rawGetDestinations(query);
    } catch (error) {
        const data = await snapshotData();
        if (!data) throw error;
        warnFallback('getDestinations', error);
        return queryDestinations(data, query);
    }
}

export async function getDestinationBySlug(
    slug: string,
    language: Language = 'es',
    include?: DestinationInclude,
): Promise<Destination | null> {
    try {
        return await rawGetDestinationBySlug(slug, language, include);
    } catch (error) {
        const data = await snapshotData();
        if (!data) throw error;
        warnFallback(`getDestinationBySlug("${slug}")`, error);
        return queryDestinationBySlug(data, slug, language, include);
    }
}

// ── branded_residences ───────────────────────────────────────────────────────

export async function getBrandedResidences(
    query: BrandedResidenceQuery = {},
): Promise<BrandedResidence[]> {
    try {
        return await rawGetBrandedResidences(query);
    } catch (error) {
        const data = await snapshotData();
        if (!data) throw error;
        warnFallback('getBrandedResidences', error);
        return queryBrandedResidences(data, query);
    }
}

export async function getBrandedResidenceBySlug(
    slug: string,
    language: Language = 'es',
): Promise<BrandedResidence | null> {
    try {
        return await rawGetBrandedResidenceBySlug(slug, language);
    } catch (error) {
        const data = await snapshotData();
        if (!data) throw error;
        warnFallback(`getBrandedResidenceBySlug("${slug}")`, error);
        return queryBrandedResidenceBySlug(data, slug, language);
    }
}

// ── developments ─────────────────────────────────────────────────────────────

export async function getDevelopments(query: DevelopmentQuery = {}): Promise<Development[]> {
    try {
        return await rawGetDevelopments(query);
    } catch (error) {
        const data = await snapshotData();
        if (!data) throw error;
        warnFallback('getDevelopments', error);
        return queryDevelopments(data, query);
    }
}

export async function getDevelopmentBySlug(
    slug: string,
    language: Language = 'es',
    include?: DevelopmentInclude,
): Promise<Development | null> {
    try {
        return await rawGetDevelopmentBySlug(slug, language, include);
    } catch (error) {
        const data = await snapshotData();
        if (!data) throw error;
        warnFallback(`getDevelopmentBySlug("${slug}")`, error);
        return queryDevelopmentBySlug(data, slug, language, include);
    }
}
