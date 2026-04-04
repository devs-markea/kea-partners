import type { APIRoute } from 'astro';
import { checkAccess } from '../../lib/restrict-access';
import { checkRateLimit } from '../../lib/rate-limiter';

const json = (data: unknown, status: number) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

export const POST: APIRoute = async ({ request }) => {
    const isDev = import.meta.env.DEV;

    // ── 1. Restricción de acceso (IP / dominio) ─────────────────────────────
    const access = checkAccess(request, isDev);
    if (!access.allowed) {
        console.warn('[RestrictAccess] Acceso denegado', { ip: access.ip, host: access.host });
        return json({ error: 'Unauthorized', ip: access.ip, host: access.host }, 401);
    }

    // ── 2. Rate limiting: 3 peticiones cada 10 minutos por IP ───────────────
    const rateLimit = await checkRateLimit(access.ip, 3, 10);
    if (!rateLimit.allowed) {
        return json({ error: 'Too many requests. Try again later.' }, 429);
    }

    // ── 3. Parsear body ──────────────────────────────────────────────────────
    let body: Record<string, string>;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Invalid JSON body' }, 400);
    }

    const {
        name,
        lastname,
        email,
        phone,
        message,
        tag = '',
        recaptchaToken,
    } = body;

    // ── 4. Validación de campos obligatorios ─────────────────────────────────
    if (
        !name?.trim()     ||
        !lastname?.trim() ||
        !email?.trim()    ||
        !phone?.trim()    ||
        !message?.trim()
    ) {
        return json({ error: 'Todos los campos son obligatorios' }, 400);
    }

    // ── 5. Modo prueba (sin envíos reales) ───────────────────────────────────
    if (import.meta.env.PUBLIC_CONTACT_TEST_MODE === 'true') {
        console.info('[ContactForm] Modo prueba — envío simulado');
        return json({ success: true, mocked: true }, 200);
    }

    // ── 6. Validación reCAPTCHA v3 ───────────────────────────────────────────
    if (!recaptchaToken) {
        return json({ error: 'Captcha no válido' }, 400);
    }

    let recaptchaData: { success: boolean; score?: number };
    try {
        const recaptchaRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret:   import.meta.env.RECAPTCHA_SECRET_KEY,
                response: recaptchaToken,
            }),
        });
        recaptchaData = await recaptchaRes.json();
    } catch {
        return json({ error: 'Error al verificar captcha' }, 500);
    }

    if (!recaptchaData.success) {
        return json({ error: 'Fallo validación reCAPTCHA' }, 400);
    }

    if (typeof recaptchaData.score === 'number' && recaptchaData.score < 0.5) {
        return json({ error: 'Captcha sospechoso' }, 400);
    }

    // ── 7. Envío a HubSpot ───────────────────────────────────────────────────
    const hubspotUrl =
        `https://api.hsforms.com/submissions/v3/integration/submit/` +
        `${import.meta.env.HUBSPOT_PORTAL_ID}/${import.meta.env.HUBSPOT_FORM_ID}`;

    let hubspotRes: Response;
    try {
        hubspotRes = await fetch(hubspotUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: [
                    { name: 'firstname', value: name.trim()     },
                    { name: 'lastname',  value: lastname.trim()  },
                    { name: 'email',     value: email.trim()     },
                    { name: 'phone',     value: phone.trim()     },
                    { name: 'message',   value: message.trim()   },
                    { name: 'tag',       value: tag.trim()       },
                ],
            }),
        });
    } catch {
        return json({ error: 'Error de conexión con HubSpot' }, 500);
    }

    if (!hubspotRes.ok) {
        const body = await hubspotRes.text().catch(() => '');
        console.error('[HubSpot] Error response:', hubspotRes.status, body);
        return json({ error: 'Error enviando a HubSpot' }, 500);
    }

    return json({ success: true }, 200);
};
