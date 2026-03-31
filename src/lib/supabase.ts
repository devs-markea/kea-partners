import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

/**
 * Cliente Supabase para uso en API routes y páginas SSR.
 * Lee la sesión desde cookies de la request y escribe cookies en la response
 * automáticamente a través del helper de Astro.
 */
export function createSupabaseClient(request: Request, cookies: AstroCookies) {
    return createServerClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return parseCookieHeader(request.headers.get('Cookie') ?? '');
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookies.set(name, value, options)
                    );
                },
            },
        }
    );
}
