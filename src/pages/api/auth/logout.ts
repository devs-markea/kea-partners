import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';

const json = (data: unknown, status: number) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

export const POST: APIRoute = async ({ request, cookies }) => {
    const supabase = createSupabaseClient(request, cookies);

    const { error } = await supabase.auth.signOut();

    if (error) {
        return json({ error: 'No se pudo cerrar sesión.' }, 500);
    }

    return json({ success: true }, 200);
};
