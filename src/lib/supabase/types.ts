/**
 * Tipos del esquema de producción de Supabase.
 * Referencia completa del esquema: doc/db/production.md.
 *
 * Dos capas:
 *   - `*Row`  → fila cruda devuelta por PostgREST (snake_case, claves de imagen
 *               sin resolver, relaciones embebidas si se piden con `select`).
 *   - dominio → objeto normalizado para las interfaces (camelCase, con las URLs
 *               de imagen ya resueltas contra Storage). Es lo que entrega el
 *               intermediario.
 */

// ── valores enumerados compartidos ─────────────────────────────────────────

/** Estado de publicación. Compartido por destinations, branded_residences y developments. */
export type PublishStatus = 'draft' | 'published' | 'inactive';

/** Idioma de un registro. */
export type Language = 'es' | 'en';

export const PUBLISH_STATUSES = ['draft', 'published', 'inactive'] as const;
export const LANGUAGES = ['es', 'en'] as const;

/** Type guard: ¿es `value` un `PublishStatus` conocido? */
export function isPublishStatus(value: unknown): value is PublishStatus {
    return typeof value === 'string'
        && (PUBLISH_STATUSES as readonly string[]).includes(value);
}

/** Type guard: ¿es `value` un `Language` conocido? */
export function isLanguage(value: unknown): value is Language {
    return typeof value === 'string'
        && (LANGUAGES as readonly string[]).includes(value);
}

/** Normaliza `language`; ante un valor desconocido cae a `es` (consumo defensivo). */
export function normalizeLanguage(raw: string, ctx: string): Language {
    if (isLanguage(raw)) return raw;
    console.warn(`[supabase/${ctx}] language desconocido: "${raw}" — se asume "es".`);
    return 'es';
}

/** Normaliza `status`; ante un valor desconocido cae a `draft` (no se publica por error). */
export function normalizeStatus(raw: string, ctx: string): PublishStatus {
    if (isPublishStatus(raw)) return raw;
    console.warn(`[supabase/${ctx}] status desconocido: "${raw}" — se asume "draft".`);
    return 'draft';
}

// ── destinations ───────────────────────────────────────────────────────────

/**
 * Fila cruda de la tabla `destinations` tal como la devuelve PostgREST.
 * Ver doc/db/production.md → «Tabla destinations».
 */
export interface DestinationRow {
    id: string;
    title: string;
    location: string;
    banner_key: string | null;
    alt: string | null;
    slug: string;
    language: string;
    status: string;
    created_at: string;
    updated_at: string;
}

/**
 * Destino normalizado que consumen las interfaces.
 * Lo entrega el intermediario (`src/lib/supabase/destinations.ts`).
 */
export interface Destination {
    id: string;
    title: string;
    location: string;
    /** Texto alternativo de la imagen (accesibilidad/SEO). `null` si no se definió. */
    alt: string | null;
    slug: string;
    language: Language;
    status: PublishStatus;
    /** Key cruda del banner en Storage. `null` si no tiene imagen. */
    bannerKey: string | null;
    /** URL pública del banner ya resuelta contra Storage. `null` si no tiene imagen. */
    bannerUrl: string | null;
    createdAt: string;
    updatedAt: string;
    /**
     * Conteo de desarrollos publicados asociados al destino.
     * Solo presente cuando la consulta lo pidió con `include.developmentsCount`.
     */
    developmentsCount?: number;
}

// ── branded_residences ─────────────────────────────────────────────────────

/**
 * Fila cruda de la tabla `branded_residences` tal como la devuelve PostgREST.
 * Ver doc/db/production.md → «Tabla branded_residences».
 */
export interface BrandedResidenceRow {
    id: string;
    name: string;
    banner_key: string | null;
    alt: string | null;
    icon_key: string | null;
    slug: string;
    language: string;
    status: string;
    created_at: string;
    updated_at: string;
}

/**
 * Branded residence / grupo normalizado que consumen las interfaces.
 * Lo entrega el intermediario (`src/lib/supabase/branded-residences.ts`).
 */
export interface BrandedResidence {
    id: string;
    name: string;
    alt: string | null;
    slug: string;
    language: Language;
    status: PublishStatus;
    bannerKey: string | null;
    bannerUrl: string | null;
    /** Key del ícono/logo en Storage. `null` si no tiene. */
    iconKey: string | null;
    /** URL pública del ícono ya resuelta contra Storage. `null` si no tiene. */
    iconUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

// ── developments ───────────────────────────────────────────────────────────

/**
 * Categorías conocidas de `developments.category`.
 *
 * El doc indica que la columna es texto libre validado por el backend —
 * en DB no hay `CHECK` para poder ampliar sin migraciones. Por eso la
 * propiedad `category` del modelo se tipa como `string`; este union es
 * solo el conjunto conocido (autocompletado y `isDevelopmentCategory`).
 */
export type DevelopmentCategory =
    | 'branded-residences'
    | 'commercial-projects'
    | 'high-end-resort';

export const DEVELOPMENT_CATEGORIES = [
    'branded-residences',
    'commercial-projects',
    'high-end-resort',
] as const;

/** Type guard: ¿es `value` una categoría conocida de development? */
export function isDevelopmentCategory(value: unknown): value is DevelopmentCategory {
    return typeof value === 'string'
        && (DEVELOPMENT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Fila cruda de la tabla `developments` tal como la devuelve PostgREST.
 * Las propiedades `destinations`, `branded_residences` y `development_articles`
 * solo están presentes cuando se piden con embedded select.
 * Ver doc/db/production.md → «Tabla developments».
 */
export interface DevelopmentRow {
    id: string;
    name: string;
    banner_key: string | null;
    alt: string | null;
    destination_id: string;
    group_id: string;
    category: string;
    icon_key: string | null;
    slug: string;
    language: string;
    status: string;
    created_at: string;
    updated_at: string;
    // Relaciones embebidas (PostgREST). Presentes solo si se incluyeron.
    destinations?: DestinationRow | null;
    branded_residences?: BrandedResidenceRow | null;
    development_articles?: DevelopmentArticleRow[];
}

/**
 * Desarrollo normalizado que consumen las interfaces.
 * Lo entrega el intermediario (`src/lib/supabase/developments.ts`).
 *
 * Las propiedades `destination`, `group` y `articles` solo están presentes
 * cuando se solicitan en `include` al hacer la consulta.
 */
export interface Development {
    id: string;
    name: string;
    alt: string | null;
    slug: string;
    language: Language;
    status: PublishStatus;
    /**
     * Categoría tal como está en DB. Las conocidas están en
     * `DevelopmentCategory` (usar `isDevelopmentCategory` para validar).
     */
    category: string;
    destinationId: string;
    groupId: string;
    bannerKey: string | null;
    bannerUrl: string | null;
    iconKey: string | null;
    iconUrl: string | null;
    createdAt: string;
    updatedAt: string;
    /** Destino al que pertenece. Solo si se pidió `include.destination`. */
    destination?: Destination | null;
    /** Grupo / branded residence al que pertenece. Solo si se pidió `include.group`. */
    group?: BrandedResidence | null;
    /** Artículos del desarrollo. Solo si se pidió `include.articles`. */
    articles?: DevelopmentArticle[];
}

// ── development_articles ───────────────────────────────────────────────────

/**
 * Fila cruda de la tabla `development_articles` tal como la devuelve PostgREST.
 * Ver doc/db/production.md → «Tabla development_articles».
 */
export interface DevelopmentArticleRow {
    id: string;
    development_id: string;
    title: string;
    url: string;
    created_at: string;
    updated_at: string;
}

/**
 * Artículo de un desarrollo, normalizado para las interfaces.
 * Lo entrega el intermediario (`src/lib/supabase/development-articles.ts`).
 *
 * No tiene `language` ni `status` propios — hereda el contexto del desarrollo
 * al que pertenece.
 */
export interface DevelopmentArticle {
    id: string;
    developmentId: string;
    title: string;
    url: string;
    createdAt: string;
    updatedAt: string;
}
