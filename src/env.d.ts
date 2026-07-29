/// <reference types="astro/client" />

/**
 * Tipado de las variables de entorno del proyecto.
 * Se fusiona (declaration merging) con el `ImportMetaEnv` base de Astro.
 */
interface ImportMetaEnv {
    /** URL del proyecto Supabase (pública). */
    readonly PUBLIC_SUPABASE_URL: string;
    /** Clave anónima de Supabase para el cliente SSR de autenticación (pública). */
    readonly PUBLIC_SUPABASE_ANON_KEY: string;
    /** Clave `service_role` de Supabase — SOLO servidor, nunca expuesta al cliente. */
    readonly SUPABASE_SERVICE_ROLE_KEY: string;
    /** Bucket de Supabase Storage para imágenes (opcional, default: `storage_partners`). */
    readonly SUPABASE_STORAGE_BUCKET?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
