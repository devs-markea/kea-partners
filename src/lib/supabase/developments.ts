/**
 * Intermediario de datos para la tabla `developments` de Supabase.
 *
 * Esquema de la tabla: doc/db/production.md → «Tabla developments».
 *
 * Lo distinto frente a destinations / branded_residences:
 *   - tiene dos FKs (`destination_id`, `group_id`) y artículos hijos,
 *   - admite filtrar por `category`, `destinationId`, `groupId`, y
 *   - admite traer relaciones embebidas (destination, group, articles)
 *     en una sola consulta vía `include` (PostgREST embedded select).
 */

import { mapBrandedResidence } from './branded-residences';
import { getServiceClient } from './client';
import { mapDestination } from './destinations';
import { mapDevelopmentArticle } from './development-articles';
import { getPublicImageUrl } from './storage';
import {
    normalizeLanguage,
    normalizeStatus,
    type Development,
    type DevelopmentCategory,
    type DevelopmentRow,
    type Language,
    type PublishStatus,
} from './types';

const TABLE = 'developments';

/** Columnas base (sin relaciones embebidas). */
const BASE_COLUMNS = [
    'id',
    'name',
    'banner_key',
    'alt',
    'destination_id',
    'group_id',
    'category',
    'icon_key',
    'slug',
    'language',
    'status',
    'created_at',
    'updated_at',
];

/** Relaciones embebidas que se pueden pedir junto al desarrollo. */
export interface DevelopmentInclude {
    /** Trae el destino del desarrollo (FK `destination_id`). */
    destination?: boolean;
    /** Trae el grupo / branded residence del desarrollo (FK `group_id`). */
    group?: boolean;
    /** Trae los artículos del desarrollo (1:M). */
    articles?: boolean;
}

/** Construye la cadena `select` añadiendo las relaciones pedidas. */
function buildSelect(include?: DevelopmentInclude): string {
    const parts = [...BASE_COLUMNS];
    if (include?.destination) parts.push('destinations(*)');
    if (include?.group)       parts.push('branded_residences(*)');
    if (include?.articles)    parts.push('development_articles(*)');
    return parts.join(', ');
}

/**
 * Convierte una fila cruda de `developments` al modelo de dominio.
 * Si la fila trae relaciones embebidas, se mapean también.
 * Exportado por simetría con los demás módulos del intermediario.
 */
export function mapDevelopment(row: DevelopmentRow): Development {
    const development: Development = {
        id: row.id,
        name: row.name,
        alt: row.alt,
        slug: row.slug,
        language: normalizeLanguage(row.language, 'developments'),
        status: normalizeStatus(row.status, 'developments'),
        category: row.category,
        destinationId: row.destination_id,
        groupId: row.group_id,
        bannerKey: row.banner_key,
        bannerUrl: getPublicImageUrl(row.banner_key),
        iconKey: row.icon_key,
        iconUrl: getPublicImageUrl(row.icon_key),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };

    // Solo se asignan las relaciones si vinieron en la respuesta (`undefined`
    // significa «no se pidió embebido», no «no existe»).
    if (row.destinations !== undefined) {
        development.destination = row.destinations ? mapDestination(row.destinations) : null;
    }
    if (row.branded_residences !== undefined) {
        development.group = row.branded_residences
            ? mapBrandedResidence(row.branded_residences)
            : null;
    }
    if (row.development_articles !== undefined) {
        development.articles = row.development_articles.map(mapDevelopmentArticle);
    }

    return development;
}

/** Filtros opcionales para listar desarrollos. */
export interface DevelopmentQuery {
    /** Filtra por estado de publicación. */
    status?: PublishStatus;
    /** Filtra por idioma. */
    language?: Language;
    /**
     * Filtra por categoría. Acepta cualquier string (el doc indica que en DB
     * no hay `CHECK` y puede ampliarse sin migración); las conocidas están en
     * `DevelopmentCategory`.
     */
    category?: DevelopmentCategory | (string & {});
    /** Filtra por destino (FK). */
    destinationId?: string;
    /** Filtra por grupo / branded residence (FK). */
    groupId?: string;
    /** Número máximo de filas a devolver. */
    limit?: number;
    /** Relaciones a traer embebidas. Por defecto, ninguna. */
    include?: DevelopmentInclude;
}

/**
 * Lista desarrollos aplicando los filtros indicados. Orden alfabético por `name`.
 * Lanza un error si la consulta falla.
 */
export async function getDevelopments(query: DevelopmentQuery = {}): Promise<Development[]> {
    let request = getServiceClient()
        .from(TABLE)
        .select(buildSelect(query.include))
        .order('name', { ascending: true });

    if (query.status)        request = request.eq('status', query.status);
    if (query.language)      request = request.eq('language', query.language);
    if (query.category)      request = request.eq('category', query.category);
    if (query.destinationId) request = request.eq('destination_id', query.destinationId);
    if (query.groupId)       request = request.eq('group_id', query.groupId);
    if (query.limit)         request = request.limit(query.limit);

    const { data, error } = await request;
    if (error) {
        console.error('[supabase/developments] Error al listar desarrollos:', error.message);
        throw new Error(`No se pudieron cargar los desarrollos: ${error.message}`);
    }

    return ((data ?? []) as unknown as DevelopmentRow[]).map(mapDevelopment);
}

/**
 * Atajo para interfaces públicas: solo desarrollos `published` de un idioma.
 *
 * Nota: el doc garantiza que todo desarrollo publicado tiene ≥ 1 artículo en
 * `development_articles` (regla aplicada por el CRM al publicar).
 */
export function getPublishedDevelopments(
    language: Language = 'es',
    include?: DevelopmentInclude,
): Promise<Development[]> {
    return getDevelopments({ status: 'published', language, include });
}

/**
 * Devuelve un desarrollo por su `slug` dentro de un idioma, o `null` si no
 * existe. El par `(language, slug)` es único.
 */
export async function getDevelopmentBySlug(
    slug: string,
    language: Language = 'es',
    include?: DevelopmentInclude,
): Promise<Development | null> {
    const { data, error } = await getServiceClient()
        .from(TABLE)
        .select(buildSelect(include))
        .eq('slug', slug)
        .eq('language', language)
        .maybeSingle();

    if (error) {
        console.error(`[supabase/developments] Error al buscar slug "${slug}":`, error.message);
        throw new Error(`No se pudo cargar el desarrollo "${slug}": ${error.message}`);
    }

    return data ? mapDevelopment(data as unknown as DevelopmentRow) : null;
}

/** Devuelve un desarrollo por su `id` (uuid), o `null` si no existe. */
export async function getDevelopmentById(
    id: string,
    include?: DevelopmentInclude,
): Promise<Development | null> {
    const { data, error } = await getServiceClient()
        .from(TABLE)
        .select(buildSelect(include))
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error(`[supabase/developments] Error al buscar id "${id}":`, error.message);
        throw new Error(`No se pudo cargar el desarrollo "${id}": ${error.message}`);
    }

    return data ? mapDevelopment(data as unknown as DevelopmentRow) : null;
}
