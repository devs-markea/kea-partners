/**
 * Intermediario de datos para la tabla `destinations` de Supabase.
 *
 * Las interfaces (páginas, componentes) NO deben hablar con Supabase
 * directamente: consumen estas funciones, que se encargan de:
 *   - consultar la base vía el cliente `service_role`,
 *   - resolver las keys de imagen contra Storage, y
 *   - devolver objetos de dominio (`Destination`) ya normalizados.
 *
 * Esquema de la tabla: doc/db/production.md → «Tabla destinations».
 */

import { getServiceClient } from './client';
import { getPublicImageUrl } from './storage';
import {
    normalizeLanguage,
    normalizeStatus,
    type Destination,
    type DestinationRow,
    type Language,
    type PublishStatus,
} from './types';

/** Nombre de la tabla en Supabase. */
const TABLE = 'destinations';

/** Columnas solicitadas a PostgREST (explícito para no transferir de más). */
const COLUMNS =
    'id, title, location, banner_key, alt, slug, language, status, created_at, updated_at';

/**
 * Convierte una fila cruda de `destinations` al modelo de dominio.
 * Exportado para componer relaciones embebidas desde otros módulos
 * (p. ej. `developments` cuando incluye su destino).
 */
export function mapDestination(row: DestinationRow): Destination {
    return {
        id: row.id,
        title: row.title,
        location: row.location,
        alt: row.alt,
        slug: row.slug,
        language: normalizeLanguage(row.language, 'destinations'),
        status: normalizeStatus(row.status, 'destinations'),
        bannerKey: row.banner_key,
        bannerUrl: getPublicImageUrl(row.banner_key),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/** Datos relacionados que se pueden traer junto al destino. */
export interface DestinationInclude {
    /**
     * Cantidad de desarrollos publicados asociados al destino.
     * Implica una consulta extra a `developments`. El resultado queda en
     * la propiedad `developmentsCount` del modelo.
     */
    developmentsCount?: boolean;
}

/** Filtros opcionales para listar destinos. */
export interface DestinationQuery {
    /** Filtra por estado de publicación. Omitir para traer todos los estados. */
    status?: PublishStatus;
    /** Filtra por idioma. Omitir para traer todos los idiomas. */
    language?: Language;
    /** Número máximo de filas a devolver. */
    limit?: number;
    /** Datos relacionados a calcular junto al destino. Por defecto, ninguno. */
    include?: DestinationInclude;
}

/**
 * Cuenta desarrollos publicados por destino. Si la consulta falla, devuelve
 * un map vacío en vez de propagar el error: el listado de destinos no debe
 * abortarse solo porque el conteo opcional no se pudo calcular.
 */
async function fetchDevelopmentsCount(
    destinationIds: string[],
    language: Language | undefined,
): Promise<Map<string, number>> {
    if (destinationIds.length === 0) return new Map();

    let request = getServiceClient()
        .from('developments')
        .select('destination_id')
        .eq('status', 'published')
        .in('destination_id', destinationIds);

    if (language) request = request.eq('language', language);

    const { data, error } = await request;
    if (error) {
        console.error('[supabase/destinations] Error al contar desarrollos:', error.message);
        return new Map();
    }

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as { destination_id: string }[]) {
        counts.set(row.destination_id, (counts.get(row.destination_id) ?? 0) + 1);
    }
    return counts;
}

/** Anota `developmentsCount` en cada destino. Mutación in-place. */
async function attachDevelopmentsCount(
    destinations: Destination[],
    language: Language | undefined,
): Promise<void> {
    const counts = await fetchDevelopmentsCount(
        destinations.map((d) => d.id),
        language,
    );
    for (const d of destinations) {
        d.developmentsCount = counts.get(d.id) ?? 0;
    }
}

/**
 * Lista destinos aplicando los filtros indicados. Orden alfabético por `title`.
 * Lanza un error si la consulta falla.
 */
export async function getDestinations(query: DestinationQuery = {}): Promise<Destination[]> {
    let request = getServiceClient()
        .from(TABLE)
        .select(COLUMNS)
        .order('title', { ascending: true });

    if (query.status)   request = request.eq('status', query.status);
    if (query.language) request = request.eq('language', query.language);
    if (query.limit)    request = request.limit(query.limit);

    const { data, error } = await request;
    if (error) {
        console.error('[supabase/destinations] Error al listar destinos:', error.message);
        throw new Error(`No se pudieron cargar los destinos: ${error.message}`);
    }

    const destinations = ((data ?? []) as unknown as DestinationRow[]).map(mapDestination);

    if (query.include?.developmentsCount) {
        await attachDevelopmentsCount(destinations, query.language);
    }

    return destinations;
}

/**
 * Atajo para interfaces públicas: solo destinos `published` de un idioma.
 * Ver doc/db/production.md → «Para consumir solo registros públicos».
 */
export function getPublishedDestinations(
    language: Language = 'es',
    include?: DestinationInclude,
): Promise<Destination[]> {
    return getDestinations({ status: 'published', language, include });
}

/**
 * Devuelve un destino por su `slug` dentro de un idioma, o `null` si no existe.
 * El par `(language, slug)` es único en la tabla.
 */
export async function getDestinationBySlug(
    slug: string,
    language: Language = 'es',
    include?: DestinationInclude,
): Promise<Destination | null> {
    const { data, error } = await getServiceClient()
        .from(TABLE)
        .select(COLUMNS)
        .eq('slug', slug)
        .eq('language', language)
        .maybeSingle();

    if (error) {
        console.error(`[supabase/destinations] Error al buscar slug "${slug}":`, error.message);
        throw new Error(`No se pudo cargar el destino "${slug}": ${error.message}`);
    }

    if (!data) return null;
    const destination = mapDestination(data as unknown as DestinationRow);
    if (include?.developmentsCount) {
        await attachDevelopmentsCount([destination], language);
    }
    return destination;
}

/** Devuelve un destino por su `id` (uuid), o `null` si no existe. */
export async function getDestinationById(
    id: string,
    include?: DestinationInclude,
): Promise<Destination | null> {
    const { data, error } = await getServiceClient()
        .from(TABLE)
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error(`[supabase/destinations] Error al buscar id "${id}":`, error.message);
        throw new Error(`No se pudo cargar el destino "${id}": ${error.message}`);
    }

    if (!data) return null;
    const destination = mapDestination(data as unknown as DestinationRow);
    if (include?.developmentsCount) {
        await attachDevelopmentsCount([destination], destination.language);
    }
    return destination;
}
