import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';
import { mapAuthError } from '../../../lib/auth-errors';

const json = (data: unknown, status: number) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

export const POST: APIRoute = async ({ request, cookies }) => {
    let body: { email?: string; password?: string; fullName?: string };
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Solicitud inválida.' }, 400);
    }

    const { email, password, fullName } = body;

    if (!email?.trim() || !password || !fullName?.trim()) {
        return json({ error: 'Todos los campos son obligatorios.' }, 400);
    }

    const supabase = createSupabaseClient(request, cookies);
    const siteUrl  = new URL(request.url).origin;

    const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
            data: { full_name: fullName.trim() },
            // Supabase enviará un email de confirmación con este redirectTo
            emailRedirectTo: `${siteUrl}/auth/callback`,
        },
    });

    if (error) {
        return json({ error: mapAuthError(error) }, 400);
    }

    // identities vacío → email ya registrado (Supabase no lo expone como error por seguridad)
    if (data.user && data.user.identities?.length === 0) {
        return json({ error: 'Ya existe una cuenta con este correo electrónico.' }, 400);
    }

    // Si email confirmation está habilitada en Supabase, session será null
    const needsConfirmation = !data.session;

    return json({ success: true, needsConfirmation }, 200);
};
