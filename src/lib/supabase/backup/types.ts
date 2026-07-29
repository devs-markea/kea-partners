/**
 * Estructura del respaldo (snapshot) de los datos de Supabase.
 *
 * Motivación: toda la información del módulo KEA Partners vive en Supabase
 * (PostgreSQL + Storage) y las páginas la consultan vía los intermediarios
 * (`src/lib/supabase/*`) en tiempo de request. Si Supabase sufre una caída, las
 * interfaces se quedan sin datos. Un *snapshot* periódico permite servir una
 * copia reciente como respaldo mientras el servicio vuelve.
 *
 * Este módulo define ÚNICAMENTE la FORMA del snapshot (el «qué»), no dónde se
 * guarda (el «dónde»): el almacenamiento es intercambiable. Ver la estrategia
 * por capas en doc/KEA_Partners/backup.md:
 *   - capa templada: Upstash Redis (refrescado por un cron), y
 *   - capa fría: JSON empaquetado en el build (`src/data/backup/snapshot.json`).
 *
 * El snapshot guarda los datos YA NORMALIZADOS (modelo de dominio, camelCase,
 * URLs de imagen resueltas): es exactamente lo que consumen las interfaces, así
 * el lector de respaldo no tiene que re-mapear nada al servirlo.
 */

import type {
    BrandedResidence,
    Destination,
    Development,
    DevelopmentArticle,
} from '../types';

/**
 * Versión del formato del snapshot. Súbela cuando cambie la forma de `data` de
 * manera incompatible: el lector descarta snapshots de versión desconocida en
 * vez de servir datos malformados (ver {@link isBackupSnapshot}).
 */
export const SNAPSHOT_VERSION = 1;

/** Destino tal como se guarda en el snapshot (sin el conteo derivado). */
export type BackupDestination = Omit<Destination, 'developmentsCount'>;

/** Branded residence en el snapshot (sin el conteo derivado). */
export type BackupBrandedResidence = Omit<BrandedResidence, 'developmentsCount'>;

/**
 * Desarrollo en el snapshot, APLANADO: sin relaciones embebidas. Las relaciones
 * (destino, grupo, artículos) se reconstruyen en memoria al leer, uniendo por
 * `destinationId` / `groupId` / `developmentId` — igual que haría PostgREST con
 * un embedded select. Evita duplicar destinos y grupos en cada desarrollo.
 */
export type BackupDevelopment = Omit<Development, 'destination' | 'group' | 'articles'>;

/** Artículo en el snapshot. Idéntico al modelo de dominio. */
export type BackupArticle = DevelopmentArticle;

/** Conteo de filas por tabla. Sirve de checksum ligero y de diagnóstico. */
export interface BackupCounts {
    destinations: number;
    brandedResidences: number;
    developments: number;
    developmentArticles: number;
}

/**
 * Datos del snapshot: una colección plana por tabla (espejo relacional de la
 * base). Guarda TODOS los estados e idiomas, no solo `published`: el respaldo
 * debe poder servir cualquier consulta que hoy hace una interfaz, incluida la
 * reconciliación legacy/API que necesita ver `draft` e `inactive`.
 */
export interface BackupData {
    destinations: BackupDestination[];
    brandedResidences: BackupBrandedResidence[];
    developments: BackupDevelopment[];
    developmentArticles: BackupArticle[];
}

/**
 * Sobre del snapshot. Además de los datos lleva metadatos para validarlo y
 * diagnosticar de dónde y cuándo salió.
 */
export interface BackupSnapshot {
    /** Versión del formato (ver {@link SNAPSHOT_VERSION}). */
    version: number;
    /** Marca de tiempo ISO-8601 de cuándo se generó el snapshot. */
    generatedAt: string;
    /** Origen del snapshot — para detectar copias de otro entorno Supabase. */
    source: {
        supabaseUrl: string;
        storageBucket: string;
    };
    /** Conteo por tabla (redundante con `data`; barato de inspeccionar). */
    counts: BackupCounts;
    /** Los datos normalizados, planos por tabla. */
    data: BackupData;
}

/**
 * Type guard defensivo para snapshots leídos de un almacén externo (Redis,
 * JSON empaquetado). NO valida campo a campo cada fila — solo la forma del
 * sobre y que la versión coincida, suficiente para no servir basura tras un
 * cambio de formato o ante un valor corrupto.
 */
export function isBackupSnapshot(value: unknown): value is BackupSnapshot {
    if (typeof value !== 'object' || value === null) return false;
    const snapshot = value as Partial<BackupSnapshot>;
    if (snapshot.version !== SNAPSHOT_VERSION) return false;
    if (typeof snapshot.generatedAt !== 'string') return false;
    if (typeof snapshot.data !== 'object' || snapshot.data === null) return false;

    const data = snapshot.data as Partial<BackupData>;
    return (
        Array.isArray(data.destinations) &&
        Array.isArray(data.brandedResidences) &&
        Array.isArray(data.developments) &&
        Array.isArray(data.developmentArticles)
    );
}
