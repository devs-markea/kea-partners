/**
 * Intermediario de datos para la tabla `development_articles` de Supabase.
 *
 * Esquema: doc/db/production.md → «Tabla development_articles».
 *
 * Los artículos NO tienen `language` ni `status` propios — heredan el contexto
 * de su desarrollo. La búsqueda casi siempre se hace por `development_id`.
 */

import { getServiceClient } from './client';
import {
    normalizeArticleType,
    type DevelopmentArticle,
    type DevelopmentArticleRow,
} from './types';

const TABLE = 'development_articles';

const COLUMNS = 'id, development_id, title, url, description, type, is_visible, created_at, updated_at';

/**
 * Convierte una fila cruda de `development_articles` al modelo de dominio.
 * Exportado para componer relaciones embebidas (p. ej. `developments.articles`).
 */
export function mapDevelopmentArticle(row: DevelopmentArticleRow): DevelopmentArticle {
    return {
        id: row.id,
        developmentId: row.development_id,
        title: row.title,
        url: row.url,
        description: row.description ?? null,
        type: normalizeArticleType(row.type, 'development-articles'),
        isVisible: row.is_visible,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * Lista los artículos de un desarrollo, ordenados por fecha de creación
 * ascendente (los más antiguos primero — refleja el orden en que se agregaron).
 */
export async function getArticlesByDevelopment(
    developmentId: string,
): Promise<DevelopmentArticle[]> {
    const { data, error } = await getServiceClient()
        .from(TABLE)
        .select(COLUMNS)
        .eq('development_id', developmentId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error(
            `[supabase/development-articles] Error al listar artículos de "${developmentId}":`,
            error.message,
        );
        throw new Error(`No se pudieron cargar los artículos: ${error.message}`);
    }

    return ((data ?? []) as unknown as DevelopmentArticleRow[]).map(mapDevelopmentArticle);
}

/** Devuelve un artículo por su `id` (uuid), o `null` si no existe. */
export async function getArticleById(id: string): Promise<DevelopmentArticle | null> {
    const { data, error } = await getServiceClient()
        .from(TABLE)
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error(`[supabase/development-articles] Error al buscar id "${id}":`, error.message);
        throw new Error(`No se pudo cargar el artículo "${id}": ${error.message}`);
    }

    return data ? mapDevelopmentArticle(data as unknown as DevelopmentArticleRow) : null;
}
