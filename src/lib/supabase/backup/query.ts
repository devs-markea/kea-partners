/**
 * Motor de consultas en memoria sobre un snapshot de respaldo.
 *
 * Replica la semántica de los intermediarios de Supabase (`destinations.ts`,
 * `branded-residences.ts`, `developments.ts`) pero operando sobre los arrays
 * planos del snapshot en vez de PostgREST: filtra por estado/idioma/categoría/
 * FKs, ordena igual, reconstruye las relaciones embebidas uniendo por las FKs
 * y recalcula `developmentsCount`. Así el lector de respaldo (`resilient.ts`)
 * puede servir exactamente lo que devolvería la API estando viva.
 *
 * Todo es síncrono: el snapshot ya está en memoria. No toca Supabase ni Redis.
 */

import type { BrandedResidenceQuery } from '../branded-residences';
import type { DestinationInclude, DestinationQuery } from '../destinations';
import type { DevelopmentInclude, DevelopmentQuery } from '../developments';
import type {
    BrandedResidence,
    Destination,
    Development,
    DevelopmentArticle,
    Language,
    PublishStatus,
} from '../types';
import type { BackupData, BackupDevelopment } from './types';

// ── helpers de filtrado comunes ─────────────────────────────────────────────

interface StatusFilter {
    status?: PublishStatus;
    statuses?: readonly PublishStatus[];
}

/**
 * Aplica el filtro de estado con la MISMA prioridad que los intermediarios:
 * `statuses` (IN) manda sobre `status` (eq); sin ninguno, no filtra.
 */
function applyStatus<T extends { status: PublishStatus }>(rows: T[], query: StatusFilter): T[] {
    if (query.statuses && query.statuses.length > 0) {
        const set = new Set(query.statuses);
        return rows.filter((r) => set.has(r.status));
    }
    if (query.status) {
        return rows.filter((r) => r.status === query.status);
    }
    return rows;
}

/**
 * Cuenta desarrollos `published` agrupados por una FK, replicando
 * `fetchDevelopmentsCount` de los intermediarios: filtra por idioma si se pide
 * y, opcionalmente, por categoría (los grupos solo cuentan los `branded-residences`).
 */
function countPublishedDevelopments(
    data: BackupData,
    keyField: 'destinationId' | 'groupId',
    language: Language | undefined,
    category?: string,
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const dev of data.developments) {
        if (dev.status !== 'published') continue;
        if (language && dev.language !== language) continue;
        if (category && dev.category !== category) continue;
        const key = dev[keyField];
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

/** Categoría que cuenta para el `developmentsCount` de un grupo. */
const BRANDED_CATEGORY = 'branded-residences';

// ── destinations ─────────────────────────────────────────────────────────────

export function queryDestinations(data: BackupData, query: DestinationQuery = {}): Destination[] {
    let rows = applyStatus(data.destinations, query);
    if (query.language) rows = rows.filter((d) => d.language === query.language);
    rows = [...rows].sort((a, b) => a.title.localeCompare(b.title));
    if (query.limit) rows = rows.slice(0, query.limit);

    const result: Destination[] = rows.map((d) => ({ ...d }));

    if (query.include?.developmentsCount) {
        const counts = countPublishedDevelopments(data, 'destinationId', query.language);
        for (const d of result) d.developmentsCount = counts.get(d.id) ?? 0;
    }
    return result;
}

export function queryDestinationBySlug(
    data: BackupData,
    slug: string,
    language: Language = 'es',
    include?: DestinationInclude,
): Destination | null {
    const row = data.destinations.find((d) => d.slug === slug && d.language === language);
    if (!row) return null;
    const destination: Destination = { ...row };
    if (include?.developmentsCount) {
        const counts = countPublishedDevelopments(data, 'destinationId', language);
        destination.developmentsCount = counts.get(destination.id) ?? 0;
    }
    return destination;
}

// ── branded_residences ───────────────────────────────────────────────────────

export function queryBrandedResidences(
    data: BackupData,
    query: BrandedResidenceQuery = {},
): BrandedResidence[] {
    let rows = applyStatus(data.brandedResidences, query);
    if (query.language) rows = rows.filter((b) => b.language === query.language);
    rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    if (query.limit) rows = rows.slice(0, query.limit);

    const result: BrandedResidence[] = rows.map((b) => ({ ...b }));

    if (query.include?.developmentsCount) {
        const counts = countPublishedDevelopments(data, 'groupId', query.language, BRANDED_CATEGORY);
        for (const b of result) b.developmentsCount = counts.get(b.id) ?? 0;
    }
    return result;
}

export function queryBrandedResidenceBySlug(
    data: BackupData,
    slug: string,
    language: Language = 'es',
): BrandedResidence | null {
    const row = data.brandedResidences.find((b) => b.slug === slug && b.language === language);
    return row ? { ...row } : null;
}

// ── developments ─────────────────────────────────────────────────────────────

/** Reconstruye las relaciones embebidas de un desarrollo a partir del snapshot. */
function embedDevelopment(
    data: BackupData,
    dev: BackupDevelopment,
    include?: DevelopmentInclude,
): Development {
    const development: Development = { ...dev };
    if (include?.destination) {
        const found = data.destinations.find((d) => d.id === dev.destinationId);
        development.destination = found ? { ...found } : null;
    }
    if (include?.group) {
        const found = data.brandedResidences.find((b) => b.id === dev.groupId);
        development.group = found ? { ...found } : null;
    }
    if (include?.articles) {
        development.articles = articlesFor(data, dev.id);
    }
    return development;
}

/** Artículos de un desarrollo, ordenados por `createdAt` asc (como el intermediario). */
function articlesFor(data: BackupData, developmentId: string): DevelopmentArticle[] {
    return data.developmentArticles
        .filter((a) => a.developmentId === developmentId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function queryDevelopments(data: BackupData, query: DevelopmentQuery = {}): Development[] {
    let rows = applyStatus(data.developments, query);
    if (query.language)      rows = rows.filter((d) => d.language === query.language);
    if (query.category)      rows = rows.filter((d) => d.category === query.category);
    if (query.destinationId) rows = rows.filter((d) => d.destinationId === query.destinationId);
    if (query.groupId)       rows = rows.filter((d) => d.groupId === query.groupId);
    rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    if (query.limit) rows = rows.slice(0, query.limit);

    return rows.map((d) => embedDevelopment(data, d, query.include));
}

export function queryDevelopmentBySlug(
    data: BackupData,
    slug: string,
    language: Language = 'es',
    include?: DevelopmentInclude,
): Development | null {
    const row = data.developments.find((d) => d.slug === slug && d.language === language);
    return row ? embedDevelopment(data, row, include) : null;
}
