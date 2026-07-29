/**
 * Configuración y validación de credenciales de Supabase para el intermediario.
 *
 * El esquema de producción (doc/db/production.md) tiene RLS activado con la
 * política `service_role full access`: SOLO el rol `service_role` puede leer
 * las tablas. Por eso el intermediario:
 *   1. se autentica siempre con la `service_role_key`, y
 *   2. se ejecuta EXCLUSIVAMENTE en el servidor — la key nunca debe llegar al
 *      navegador (de ahí que NO use el prefijo `PUBLIC_`).
 */

/** Bucket de Supabase Storage donde viven banners e íconos. */
export const STORAGE_BUCKET: string =
    import.meta.env.SUPABASE_STORAGE_BUCKET || 'storage_partners';

/** Lanza un error claro si una variable de entorno obligatoria falta. */
function requireEnv(name: string, value: string | undefined): string {
    const trimmed = value?.trim();
    if (!trimmed) {
        throw new Error(
            `[supabase] Falta la variable de entorno "${name}". ` +
            'Defínela en .env.local antes de consumir datos de Supabase ' +
            '(Supabase → Project Settings → API).'
        );
    }
    return trimmed;
}

/** URL del proyecto Supabase. */
export function getSupabaseUrl(): string {
    return requireEnv('PUBLIC_SUPABASE_URL', import.meta.env.PUBLIC_SUPABASE_URL);
}

/** Clave `service_role` — acceso total a la base, SOLO servidor. */
export function getServiceRoleKey(): string {
    return requireEnv(
        'SUPABASE_SERVICE_ROLE_KEY',
        import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );
}
