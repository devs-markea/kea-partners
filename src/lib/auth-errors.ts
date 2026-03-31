/**
 * Mapea los errores de Supabase Auth a mensajes en español amigables.
 * Se consultan primero los `code` (Supabase v2) y luego el `message` como fallback.
 *
 * Referencia: https://supabase.com/docs/reference/javascript/auth-error-codes
 */
export function mapAuthError(error: { message?: string; code?: string } | null): string {
    if (!error) return 'Error desconocido.';

    const code = error.code ?? '';
    const msg  = (error.message ?? '').toLowerCase();

    // — Credenciales incorrectas —
    if (code === 'invalid_credentials' || msg.includes('invalid login credentials'))
        return 'Correo o contraseña incorrectos.';

    // — Email sin confirmar —
    if (code === 'email_not_confirmed' || msg.includes('email not confirmed'))
        return 'Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja.';

    // — Usuario ya registrado —
    if (
        code === 'user_already_exists' ||
        msg.includes('user already registered') ||
        msg.includes('already been registered')
    )
        return 'Ya existe una cuenta con este correo electrónico.';

    // — Contraseña débil —
    if (
        code === 'weak_password' ||
        msg.includes('password should be at least') ||
        msg.includes('should contain')
    )
        return 'La contraseña es demasiado débil. Usa al menos 8 caracteres con mayúsculas, números y símbolos.';

    // — Formato de correo inválido —
    if (
        code === 'email_address_invalid' ||
        msg.includes('invalid format') ||
        msg.includes('unable to validate email')
    )
        return 'El formato del correo electrónico no es válido.';

    // — Demasiados intentos —
    if (
        code === 'over_email_send_rate_limit' ||
        code === 'email_rate_limit_exceeded' ||
        msg.includes('rate limit') ||
        msg.includes('60 seconds') ||
        msg.includes('too many requests')
    )
        return 'Demasiados intentos. Espera unos minutos antes de intentarlo de nuevo.';

    // — Token / enlace expirado —
    if (
        code === 'otp_expired' ||
        code === 'flow_state_expired' ||
        code === 'token_expired' ||
        (msg.includes('expired') && (msg.includes('token') || msg.includes('otp')))
    )
        return 'El enlace ha expirado. Solicita uno nuevo.';

    // — Misma contraseña —
    if (code === 'same_password' || msg.includes('different from'))
        return 'La nueva contraseña debe ser diferente a la anterior.';

    // — Registro deshabilitado —
    if (code === 'signup_disabled' || msg.includes('signup is disabled'))
        return 'El registro está deshabilitado temporalmente.';

    // — Sesión inválida (reset sin haber pasado por el callback) —
    if (code === 'session_not_found' || (msg.includes('session') && msg.includes('not found')))
        return 'Sesión no válida. Utiliza el enlace del correo nuevamente.';

    return 'Ocurrió un error. Por favor inténtalo de nuevo.';
}
