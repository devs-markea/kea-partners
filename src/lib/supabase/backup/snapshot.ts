/**
 * Construcción del snapshot de respaldo a partir de Supabase.
 *
 * Lee las 4 tablas con TODOS sus estados e idiomas (no solo `published`): el
 * respaldo debe poder servir cualquier consulta que hoy hace una interfaz,
 * incluida la reconciliación legacy/API que necesita ver `draft` e `inactive`
 * (ver src/pages/index.astro → «Reglas de visualización y prioridad de datos»).
 *
 * Produce un `BackupSnapshot` listo para serializar a JSON y guardar donde sea
 * (Redis, Vercel Blob, JSON en el repo). NO decide el almacenamiento: quien
 * llama (un endpoint de cron o un script de build) se encarga de persistirlo.
 *
 * ⚠️ SOLO SERVIDOR: usa el cliente `service_role` a través de los
 * intermediarios. Nunca importar desde código que se hidrata en el navegador.
 */

import { getBrandedResidences } from '../branded-residences';
import { STORAGE_BUCKET, getSupabaseUrl } from '../config';
import { getDestinations } from '../destinations';
import { getDevelopments } from '../developments';
import {
    SNAPSHOT_VERSION,
    type BackupArticle,
    type BackupDevelopment,
    type BackupSnapshot,
} from './types';

/**
 * Lee Supabase completo y arma el snapshot.
 *
 * Propaga el error si alguna de las consultas falla: un snapshot a medias no
 * debe sobrescribir uno bueno. Quien llama decide qué hacer ante el fallo
 * (reintentar, conservar el snapshot previo, alertar…).
 *
 * @param now Marca de tiempo ISO-8601 a estampar en `generatedAt`. Por defecto,
 *            el instante actual; parametrizable para pruebas deterministas.
 */
export async function buildSnapshot(
    now: string = new Date().toISOString(),
): Promise<BackupSnapshot> {
    // Las tres consultas son independientes → en paralelo. Los desarrollos
    // traen sus artículos embebidos para no hacer una consulta por desarrollo.
    const [destinations, brandedResidences, developmentsWithArticles] = await Promise.all([
        getDestinations({}),
        getBrandedResidences({}),
        getDevelopments({ include: { articles: true } }),
    ]);

    // Aplanar: el snapshot guarda los desarrollos SIN relaciones embebidas y los
    // artículos en su propia colección (espejo relacional de la base). El lector
    // de respaldo vuelve a unir por las FKs cuando una interfaz pida embebidos.
    const developments: BackupDevelopment[] = [];
    const developmentArticles: BackupArticle[] = [];
    for (const dev of developmentsWithArticles) {
        // `destination` y `group` se descartan vía rest: el snapshot es plano.
        const { destination, group, articles, ...flat } = dev;
        developments.push(flat);
        if (articles) developmentArticles.push(...articles);
    }

    return {
        version: SNAPSHOT_VERSION,
        generatedAt: now,
        source: {
            supabaseUrl: getSupabaseUrl(),
            storageBucket: STORAGE_BUCKET,
        },
        counts: {
            destinations: destinations.length,
            brandedResidences: brandedResidences.length,
            developments: developments.length,
            developmentArticles: developmentArticles.length,
        },
        data: {
            destinations,
            brandedResidences,
            developments,
            developmentArticles,
        },
    };
}
