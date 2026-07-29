/**
 * Cliente Supabase del intermediario de datos.
 *
 * Distinto del cliente de `src/lib/supabase.ts`: aquél es el cliente SSR de
 * autenticación (lee/escribe cookies de sesión); éste accede a las tablas de
 * contenido con privilegios de `service_role`.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceRoleKey, getSupabaseUrl } from './config';

let client: SupabaseClient | null = null;

/**
 * Devuelve el cliente Supabase con privilegios de `service_role`.
 *
 * ⚠️ SOLO SERVIDOR. La `service_role_key` salta RLS por completo; si llega al
 * navegador, cualquiera tendría acceso total a la base. Importa este módulo
 * únicamente desde código que corre en el servidor: frontmatter de páginas
 * `.astro`, API routes (`src/pages/api/**`) o middleware. Nunca desde un
 * `<script>` de cliente ni desde componentes que se hidratan.
 *
 * El cliente se cachea entre invocaciones para reutilizarlo.
 */
export function getServiceClient(): SupabaseClient {
    if (client) return client;
    client = createClient(getSupabaseUrl(), getServiceRoleKey(), {
        auth: {
            // El intermediario no maneja sesiones de usuario: solo lee datos.
            persistSession: false,
            autoRefreshToken: false,
        },
    });
    return client;
}
