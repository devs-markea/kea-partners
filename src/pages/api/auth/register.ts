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
    // Rate limit: 5 registros por IP cada hora
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? request.headers.get('x-real-ip')
            ?? 'unknown';
    const rl = await checkRateLimit(`register:${ip}`, 5, 60);
    if (!rl.allowed) {
        return json({ error: 'Demasiados intentos. Espera unos minutos antes de intentarlo de nuevo.' }, 429);
    }

    let body: { email?: string; password?: string; fullName?: string; termsAccepted?: boolean };
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Solicitud inválida.' }, 400);
    }

    const { email, password, fullName, termsAccepted } = body;

    if (!email?.trim() || !password || !fullName?.trim()) {
        return json({ error: 'Todos los campos son obligatorios.' }, 400);
    }

    if (!termsAccepted) {
        return json({ error: 'Debes aceptar los términos de servicio.' }, 400);
    }

    const supabase = createSupabaseClient(request, cookies);
    const siteUrl  = new URL(request.url).origin;

    const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
            data: {
                full_name:          fullName.trim(),
                terms_accepted:     true,
                terms_accepted_at:  new Date().toISOString(),
                terms_version:      '1.0',
            },
            emailRedirectTo: `${siteUrl}/auth/callback`,
        },
    });

    if (error) {
        return json({ error: mapAuthError(error) }, 400);
    }

    // Siempre responder igual para no revelar si el email ya está registrado.
    // Si identities está vacío, Supabase no creó una cuenta nueva (email ya existe),
    // pero respondemos como si se hubiera enviado el correo de confirmación.
    return json({ success: true, needsConfirmation: true }, 200);
};
