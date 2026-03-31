import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';

const json = (data: unknown, status: number) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

export const POST: APIRoute = async ({ request, cookies }) => {
    let body: { email?: string };
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Solicitud inválida.' }, 400);
    }

    const { email } = body;

    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: 'Ingresa un correo electrónico válido.' }, 400);
    }

    const supabase = createSupabaseClient(request, cookies);
    const siteUrl  = new URL(request.url).origin;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // El callback leerá ?next=/reset-password y redirigirá allí
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    });

    // Por seguridad no revelamos si el correo existe o no.
    // Solo respondemos success=true en ambos casos (con o sin error de usuario no encontrado).
    if (error && error.message?.toLowerCase().includes('rate limit')) {
        return json({ error: 'Demasiados intentos. Espera unos minutos.' }, 429);
    }

    return json({ success: true }, 200);
};
