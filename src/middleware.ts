import { defineMiddleware } from 'astro:middleware';
import { createSupabaseClient } from './lib/supabase';

/**
 * Rutas siempre accesibles sin sesión.
 * Todo lo demás requiere estar autenticado.
 */
const PUBLIC_ROUTES = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/auth',        // /auth/callback y cualquier sub-ruta
];

/**
 * Rutas de autenticación desde las que se redirige a /
 * si el usuario ya tiene sesión activa.
 */
const AUTH_ONLY_ROUTES = [
    '/login',
    '/register',
    '/forgot-password',
];

function isPublic(pathname: string): boolean {
    return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
}

function isAuthOnly(pathname: string): boolean {
    return AUTH_ONLY_ROUTES.some(route => pathname === route);
}

export const onRequest = defineMiddleware(async ({ request, cookies, redirect }, next) => {
    const { pathname } = new URL(request.url);

    // Las API routes manejan su propia autenticación — no interferir
    if (pathname.startsWith('/api/')) return next();

    // Recursos estáticos de Astro — no interferir
    if (pathname.startsWith('/_astro/')) return next();

    const isPublicRoute  = isPublic(pathname);
    const isAuthOnlyRoute = isAuthOnly(pathname);

    // Si la ruta es completamente pública y no es una ruta de auth, pasar
    if (isPublicRoute && !isAuthOnlyRoute) return next();

    // Obtener sesión
    const supabase = createSupabaseClient(request, cookies);
    const { data: { session } } = await supabase.auth.getSession();

    // Usuario autenticado intentando acceder a login/register/forgot → redirigir al inicio
    if (isAuthOnlyRoute && session) {
        return redirect('/');
    }

    // Usuario no autenticado intentando acceder a una ruta protegida → redirigir al login
    if (!isPublicRoute && !session) {
        const redirectParam = pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
        return redirect(`/login${redirectParam}`);
    }

    return next();
});
