import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';
import { mapAuthError } from '../../../lib/auth-errors';

const json = (data: unknown, status: number) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

export const POST: APIRoute = async ({ request, cookies }) => {
    let body: { password?: string };
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Solicitud inválida.' }, 400);
    }

    const { password } = body;

    if (!password || password.length < 8) {
        return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
    }

    const supabase = createSupabaseClient(request, cookies);

    // Verificar que hay sesión activa (el usuario llegó por el link del correo)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
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
