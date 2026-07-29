/**
 * Intermediario de datos para la tabla `branded_residences` de Supabase.
 *
 * Esquema de la tabla: doc/db/production.md → «Tabla branded_residences».
 * El consumo se hace siempre a través de estas funciones (nunca directo
 * a Supabase desde las interfaces).
 */

import { getServiceClient } from './client';
import { getPublicImageUrl } from './storage';
import {
    normalizeLanguage,
    normalizeStatus,
    type BrandedResidence,
    type BrandedResidenceRow,
    type Language,
    type PublishStatus,
} from './types';

const TABLE = 'branded_residences';

const COLUMNS =
    'id, name, banner_key, alt, icon_key, slug, language, status, created_at, updated_at';

/**
 * Categoría de `developments` que cuenta para la visibilidad de un grupo:
 * un branded residence «existe» en la home si tiene desarrollos de este tipo.
 */
const BRANDED_CATEGORY = 'branded-residences';

/**
 * Convierte una fila cruda de `branded_residences` al modelo de dominio.
 * Exportado para componer relaciones embebidas (p. ej. `developments.group`).
 */
export function mapBrandedResidence(row: BrandedResidenceRow): BrandedResidence {
    return {
        id: row.id,
        name: row.name,
        alt: row.alt,
        slug: row.slug,
        language: normalizeLanguage(row.language, 'branded-residences'),
        status: normalizeStatus(row.status, 'branded-residences'),
        bannerKey: row.banner_key,
        bannerUrl: getPublicImageUrl(row.banner_key),
        iconKey: row.icon_key,
        iconUrl: getPublicImageUrl(row.icon_key),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/** Datos relacionados que se pueden traer junto a la branded residence. */
export interface BrandedResidenceInclude {
    /**
     * Cantidad de desarrollos publicados de categoría `branded-residences`
     * asociados al grupo. Implica una consulta extra a `developments`. El
     * resultado queda en la propiedad `developmentsCount` del modelo.
     */
    developmentsCount?: boolean;
}

/** Filtros opcionales para listar branded residences. */
export interface BrandedResidenceQuery {
    /** Filtra por estado de publicación. Omitir para traer todos. */
    status?: PublishStatus;
    /**
     * Filtra por un conjunto de estados (`status IN (...)`). Útil para la
     * reconciliación legacy/API, que necesita considerar también los `inactive`.
     * Tiene prioridad sobre `status` si ambos se indican.
     */
    statuses?: readonly PublishStatus[];
    /** Filtra por idioma. Omitir para traer todos. */
    language?: Language;
    /** Número máximo de filas a devolver. */
    limit?: number;
    /** Datos relacionados a calcular junto al grupo. Por defecto, ninguno. */
    include?: BrandedResidenceInclude;
}

/**
 * Cuenta desarrollos publicados de categoría `branded-residences` por grupo.
 * Si la consulta falla, devuelve un map vacío en vez de propagar el error:
 * el listado no debe abortarse porque el conteo opcional no se pudo calcular.
 */
async function fetchDevelopmentsCount(
    groupIds: string[],
    language: Language | undefined,
): Promise<Map<string, number>> {
    if (groupIds.length === 0) return new Map();

    let request = getServiceClient()
        .from('developments')
        .select('group_id')
        .eq('status', 'published')
        .eq('category', BRANDED_CATEGORY)
        .in('group_id', groupIds);

    if (language) request = request.eq('language', language);

    const { data, error } = await request;
    if (error) {
        console.error('[supabase/branded-residences] Error al contar desarrollos:', error.message);
        return new Map();
    }

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as { group_id: string }[]) {
        counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
    }
    return counts;
}

/** Anota `developmentsCount` en cada grupo. Mutación in-place. */
async function attachDevelopmentsCount(
    residences: BrandedResidence[],
    language: Language | undefined,
): Promise<void> {
    const counts = await fetchDevelopmentsCount(
        residences.map((r) => r.id),
        language,
    );
    for (const r of residences) {
        r.developmentsCount = counts.get(r.id) ?? 0;
    }
}

/**
 * Lista branded residences aplicando los filtros indicados.
 * Orden alfabético por `name`. Lanza un error si la consulta falla.
 */
export async function getBrandedResidences(
    query: BrandedResidenceQuery = {},
): Promise<BrandedResidence[]> {
    let request = getServiceClient()
        .from(TABLE)
        .select(COLUMNS)
        .order('name', { ascending: true });

    if (query.statuses && query.statuses.length > 0) {
        request = request.in('status', query.statuses as string[]);
    } else if (query.status) {
        request = request.eq('status', query.status);
    }
    if (query.language) request = request.eq('language', query.language);
    if (query.limit)    request = request.limit(query.limit);

    const { data, error } = await request;
    if (error) {
        console.error('[supabase/branded-residences] Error al listar:', error.message);
        throw new Error(`No se pudieron cargar las branded residences: ${error.message}`);
    }

    const residences = ((data ?? []) as unknown as BrandedResidenceRow[]).map(mapBrandedResidence);

    if (query.include?.developmentsCount) {
        await attachDevelopmentsCount(residences, query.language);
    }

    return residences;
}

/** Atajo para interfaces públicas: solo `published` de un idioma. */
export function getPublishedBrandedResidences(
    language: Language = 'es',
    include?: BrandedResidenceInclude,
): Promise<BrandedResidence[]> {
    return getBrandedResidences({ status: 'published', language, include });
}

/**
 * Devuelve una branded residence por su `slug` dentro de un idioma, o `null`
 * si no existe. El par `(language, slug)` es único.
 */
export async function getBrandedResidenceBySlug(
    slug: string,
    language: Language = 'es',
): Promise<BrandedResidence | null> {
    const { data, error } = await getServiceClient()
        .from(TABLE)
        .select(COLUMNS)
        .eq('slug', slug)
        .eq('language', language)
        .maybeSingle();

    if (error) {
        console.error(`[supabase/branded-residences] Error al buscar slug "${slug}":`, error.message);
        throw new Error(`No se pudo cargar la branded residence "${slug}": ${error.message}`);
    }

    return data ? mapBrandedResidence(data as unknown as BrandedResidenceRow) : null;
}

/** Devuelve una branded residence por su `id` (uuid), o `null` si no existe. */
export async function getBrandedResidenceById(id: string): Promise<BrandedResidence | null> {
    const { data, error } = await getServiceClient()
        .from(TABLE)
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error(`[supabase/branded-residences] Error al buscar id "${id}":`, error.message);
        throw new Error(`No se pudo cargar la branded residence "${id}": ${error.message}`);
    }

    return data ? mapBrandedResidence(data as unknown as BrandedResidenceRow) : null;
}
