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
    // Rate limit: 10 intentos por IP cada 15 minutos
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? request.headers.get('x-real-ip')
            ?? 'unknown';
    const rl = checkRateLimit(`login:${ip}`, 10, 15);
    if (!rl.allowed) {
        return json({ error: 'Demasiados intentos. Espera unos minutos antes de intentarlo de nuevo.' }, 429);
    }

    let body: { email?: string; password?: string };
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Solicitud inválida.' }, 400);
    }

    const { email, password } = body;

    if (!email?.trim() || !password) {
        return json({ error: 'Correo y contraseña son obligatorios.' }, 400);
    }

    const supabase = createSupabaseClient(request, cookies);

    const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
    });

    if (error) {
        return json({ error: mapAuthError(error) }, 401);
    }

    return json({ success: true }, 200);
};
