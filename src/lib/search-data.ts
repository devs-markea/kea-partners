/**
 * Fuente de datos del buscador: reconcilia los documentos legacy (JSON local)
 * con los desarrollos de Supabase, con PRIORIDAD de la API.
 *
 * Reglas (doc/KEA_Partners/db → «Reglas de visualización y prioridad de datos»,
 * las mismas que aplica `src/pages/index.astro`):
 *   - La EXISTENCIA de un desarrollo en la API invalida a su homónimo legacy en
 *     CUALQUIER estado (`published`/`inactive`/`draft`) → por eso se traen los 3.
 *   - Solo los desarrollos `published` se muestran; de ellos, solo los artículos
 *     con `is_visible = true`.
 *   - Un desarrollo sin contraparte en la API cae al legacy de respaldo.
 * El match es a nivel DESARROLLO, por NOMBRE (legacy `project` ↔ api `name`),
 * normalizado. Al casar, TODO el desarrollo legacy (todos sus artículos) se
 * neutraliza y solo cuentan los de la API.
 *
 * Los filtros de ocultamiento legacy (`hide-attributes`) se aplican después, en
 * `searchDocuments`, y solo afectan a documentos legacy.
 *
 * ⚠️ SOLO SERVIDOR: importa (vía `resilient`) el cliente `service_role`. No lo
 * importes desde código de cliente — para el buscador en vivo usa `/api/search`.
 */

import { mergeHybrid } from "./hybrid";
import { ARTICLE_TYPE_LABELS, LEGACY_DOCUMENTS, type SearchDocument } from "./search";
import { getDevelopments } from "./supabase/resilient";
import type { Development, Language, PublishStatus } from "./supabase/types";

// La existencia en la API (en cualquiera de estos estados) invalida al legacy.
const RECONCILE_STATUSES: readonly PublishStatus[] = ["published", "inactive", "draft"];
const isPublished = (status: PublishStatus) => status === "published";

/** Clave de match: nombre normalizado (minúsculas + sin acentos + espacios colapsados). */
function nameKey(name?: string | null): string {
    return (name ?? "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

/** Un desarrollo legacy: su nombre (`project`) y sus documentos-artículo. */
interface LegacyGroup {
    name: string;
    docs: SearchDocument[];
}

/** Agrupa los documentos legacy por desarrollo (`project`). */
function groupLegacyByProject(docs: SearchDocument[]): LegacyGroup[] {
    const byProject = new Map<string, LegacyGroup>();
    for (const doc of docs) {
        const name = doc.project ?? "";
        let group = byProject.get(name);
        if (!group) {
            group = { name, docs: [] };
            byProject.set(name, group);
        }
        group.docs.push(doc);
    }
    return [...byProject.values()];
}

/**
 * Convierte un desarrollo de la API (ya filtrado como `published`) en documentos
 * de búsqueda: uno por artículo VISIBLE. Mapea los campos al mismo shape que el
 * legacy para que `searchDocuments` trabaje uniforme.
 */
function apiDevelopmentToDocuments(dev: Development): SearchDocument[] {
    return (dev.articles ?? [])
        .filter((article) => article.isVisible)
        .map((article) => ({
            project: dev.name,
            title: article.title,
            slug: article.url,
            description: article.description ?? "",
            // `type` = etiqueta visible (Fuse/UI); `typeKey` = key para la lógica.
            type: ARTICLE_TYPE_LABELS[article.type],
            typeKey: article.type,
            // destino (país) = destinations.location; micro = destinations.title.
            destination: dev.destination?.location ?? "",
            microDestination: dev.destination?.title ?? "",
            category: dev.category,
            // Logo remoto (Storage). La resolución source-aware queda para cuando
            // se reactive la muestra de logos.
            image: dev.iconUrl ?? "",
            source: "api" as const,
        }));
}

/**
 * Construye el set de documentos de búsqueda reconciliando legacy + API.
 * Si la API falla por completo (y no hay respaldo), degrada a solo legacy.
 */
export async function buildSearchDocuments(
    language: Language = "es",
): Promise<SearchDocument[]> {
    const apiDevelopments = await getDevelopments({
        language,
        statuses: RECONCILE_STATUSES,
        include: { articles: true, destination: true },
    }).catch((error) => {
        console.error("[search-data] No se pudieron cargar desarrollos de Supabase:", error);
        return [] as Development[];
    });

    // Reconciliación a nivel DESARROLLO. Cada entrada produce los documentos-
    // artículo de ese desarrollo (API si gana; legacy si no hay contraparte).
    const perDevelopment = mergeHybrid<LegacyGroup, Development, SearchDocument[]>({
        legacy: groupLegacyByProject(LEGACY_DOCUMENTS),
        api: apiDevelopments,
        legacyKey: (l) => nameKey(l.name),
        apiKey: (a) => nameKey(a.name),
        keepApi: (a) => isPublished(a.status),
        merge: (legacy, api) => (api ? apiDevelopmentToDocuments(api) : legacy!.docs),
    });

    return perDevelopment.flat();
}

// ── Cache en memoria (evita reconstruir/pegarle a Supabase por cada keystroke) ──
const CACHE_TTL_MS = 60_000;
const cache = new Map<Language, { at: number; docs: SearchDocument[] }>();

/**
 * Igual que `buildSearchDocuments`, con cache por idioma (TTL corto). Es lo que
 * consumen la página y el endpoint `/api/search`.
 */
export async function getSearchDocuments(language: Language = "es"): Promise<SearchDocument[]> {
    const hit = cache.get(language);
    const now = Date.now();
    if (hit && now - hit.at < CACHE_TTL_MS) return hit.docs;

    const docs = await buildSearchDocuments(language);
    cache.set(language, { at: now, docs });
    return docs;
}
