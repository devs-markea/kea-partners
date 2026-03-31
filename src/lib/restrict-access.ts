/**
 * Equivalente a RestrictFrontendAccess de Laravel.
 *
 * Lógica:
 * - En desarrollo: siempre permitido.
 * - IPs locales (127.0.0.1, ::1): siempre permitidas.
 * - allowedIps: backends, workers, crons identificados por IP fija.
 * - allowedDomains: frontends/browsers identificados por Origin o Referer.
 * - Cualquier petición fuera de estas listas → 401.
 */

const allowedIps: string[] = [
    '35.215.97.219',
];

const allowedDomains: string[] = [
    'staging.rodrigos66.sg-host.com',
    'kea-partners.vercel.app', // dominio Vercel de producción — ajustar al dominio real
];

const localIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

function parseHost(rawUrl: string | null): string | null {
    if (!rawUrl) return null;
    try {
        return new URL(rawUrl).hostname;
    } catch {
        return null;
    }
}

export interface AccessResult {
    allowed: boolean;
    ip: string;
    host: string | null;
}

export function checkAccess(request: Request, isDev: boolean): AccessResult {
    // En desarrollo siempre se permite
    if (isDev) return { allowed: true, ip: 'local', host: null };

    const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        '';

    const origin  = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host    = parseHost(origin) ?? parseHost(referer);

    const isLocalIp      = localIps.includes(ip);
    const isAllowedIp    = allowedIps.includes(ip);
    const isAllowedDomain = host ? allowedDomains.includes(host) : false;

    const allowed = isLocalIp || isAllowedIp || isAllowedDomain;

    return { allowed, ip, host };
}
