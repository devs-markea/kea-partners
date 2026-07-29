/**
 * Resolución de imágenes de Supabase Storage.
 *
 * Las tablas guardan solo la _key_ del archivo (ej. `destinations/tulum.jpg`),
 * nunca el binario. Estas funciones convierten esa key en una URL utilizable
 * por las interfaces. Bucket por defecto: `storage_partners`.
 *
 * Ver doc/db/production.md → «Imágenes (Supabase Storage)».
 */

import { getServiceClient } from './client';
import { STORAGE_BUCKET } from './config';

/**
 * Convierte una key de Storage en su URL pública.
 * Devuelve `null` si la key es nula o vacía.
 *
 * `getPublicUrl` solo compone la cadena (no hace petición de red); es válido
 * cuando el bucket es público. Si el bucket fuese privado, usar
 * {@link getSignedImageUrl}.
 */
export function getPublicImageUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    const { data } = getServiceClient()
        .storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(key);
    return data.publicUrl || null;
}

/**
 * Genera una URL firmada y temporal para una key de Storage (bucket privado).
 * Devuelve `null` si la key es nula/vacía o si la firma falla.
 *
 * @param expiresIn Validez de la URL en segundos (default: 3600 = 1 hora).
 */
export async function getSignedImageUrl(
    key: string | null | undefined,
    expiresIn = 3600,
): Promise<string | null> {
    if (!key) return null;
    const { data, error } = await getServiceClient()
        .storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(key, expiresIn);

    if (error) {
        console.error(`[supabase/storage] No se pudo firmar la key "${key}":`, error.message);
        return null;
    }
    return data.signedUrl;
}
