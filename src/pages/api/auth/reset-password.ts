import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';
import { mapAuthError } from '../../../lib/auth-errors';
import { checkRateLimit } from '../../../lib/rate-limiter';

const json = (data: unknown, status: number) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

export const POST: APIRoute = async ({ request, cookies }) => {
    // Rate limit: 5 intentos por IP cada 15 minutos
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? request.headers.get('x-real-ip')
            ?? 'unknown';
    const rl = await checkRateLimit(`reset:${ip}`, 5, 15);
    if (!rl.allowed) {
        return json({ error: 'Demasiados intentos. Espera unos minutos antes de intentarlo de nuevo.' }, 429);
    }

    let body: { password?: string };
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Solicitud inválida.' }, 400);
    }

    const { password } = body;

    // Validar la misma política configurada en Supabase:
    // mínimo 8 caracteres, mayúscula, minúscula, número y símbolo
    const meetsPolicy = (p: string) =>
        p.length >= 8 &&
        /[a-z]/.test(p) &&
        /[A-Z]/.test(p) &&
        /[0-9]/.test(p) &&
        /[^A-Za-z0-9]/.test(p);

    if (!password || !meetsPolicy(password)) {
        return json({ error: 'La contraseña debe tener al menos 8 caracteres con mayúscula, minúscula, número y símbolo.' }, 400);
    }

    const supabase = createSupabaseClient(request, cookies);

    // Verificar que hay usuario autenticado (getUser valida el JWT server-side)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return json({ error: 'Sesión no válida. Utiliza el enlace del correo nuevamente.' }, 401);
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
        return json({ error: mapAuthError(error) }, 400);
    }

    // Cerrar sesión después del cambio de contraseña para forzar un nuevo login
    await supabase.auth.signOut();

    return json({ success: true }, 200);
};
