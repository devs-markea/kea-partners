import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';
import { mapAuthError } from '../../../lib/auth-errors';

const json = (data: unknown, status: number) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

export const POST: APIRoute = async ({ request, cookies }) => {
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

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
    });

    if (error) {
        return json({ error: mapAuthError(error) }, 401);
    }

    return json({
        success: true,
        user: { id: data.user.id, email: data.user.email },
    }, 200);
};
