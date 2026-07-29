import Fuse from "fuse.js";
import developmentDocuments from "../data/search/documents/development.json";
import HideAttributes from "../data/i18n/es/hide-attributes-development.json";
import type { ArticleType } from "./supabase/types";

/**
 * Lógica de búsqueda compartida por la página de resultados
 * (`src/pages/search.astro`) y el componente de buscador
 * (`src/components/Search.astro`). Antes ambos duplicaban —de forma idéntica
 * pero independiente— las opciones de Fuse, el orden de resultados y el filtro
 * de atributos ocultos. Aquí queda una única fuente de verdad.
 */

export interface SearchDocument {
    /** Etiqueta visible del tipo ("Artículo" / "Página de Recursos"). Se indexa en Fuse y se muestra en UI. */
    type?: string;
    /**
     * Key normalizada del tipo, para lógica (orden "Recursos primero"). El JSON
     * legacy crudo no la trae: se deriva de `type` con `resourceTypeKey`.
     */
    typeKey?: ArticleType;
    image?: string;
    destination?: string;
    microDestination?: string;
    project?: string;
    category?: string;
    title?: string;
    description?: string;
    slug?: string;
    /**
     * Origen del documento. El filtro de atributos ocultos
     * (`hide-attributes-development.json`) es un concepto legacy: solo aplica a
     * documentos locales. Los que vienen de la API deben marcarse con
     * `source: "api"` para que el filtro los ignore. Su ausencia equivale a
     * legacy (que es lo que hoy entrega el JSON local).
     */
    source?: "legacy" | "api";
}

/** Documentos legacy (JSON local). Fuente por defecto del buscador. */
export const LEGACY_DOCUMENTS = developmentDocuments as SearchDocument[];

/** Opciones de Fuse compartidas por la página y el componente de búsqueda. */
export const FUSE_OPTIONS = {
    includeScore: true,
    threshold: 0.4,
    shouldSort: true,
    keys: [
        { name: "project", weight: 1.2 },
        { name: "type", weight: 1 },
        { name: "destination", weight: 0.75 },
        { name: "microDestination", weight: 0.5 },
        { name: "title", weight: 0.25 },
        { name: "description", weight: 0.1 },
    ],
};

type HideAttributesEntry = {
    developmentProject?: string;
    developmentAttribututes: Array<{ attribute: string }>;
};

// Mapa proyecto(min) -> atributos(min) que deben ocultarse.
const hiddenAttributesByProject: Record<string, string[]> = Object.fromEntries(
    (HideAttributes.developments as HideAttributesEntry[])
        .filter((d) => d.developmentProject)
        .map((d) => [
            d.developmentProject!.toLowerCase(),
            d.developmentAttribututes.map((a) => a.attribute.toLowerCase()),
        ])
);

/** Un documento es legacy salvo que venga explícitamente marcado como de la API. */
function isLegacy(item: SearchDocument): boolean {
    return item.source !== "api";
}

/**
 * El filtro de atributos ocultos SOLO aplica a documentos legacy. Los de la API
 * se muestran siempre.
 */
function isHidden(item: SearchDocument): boolean {
    if (!isLegacy(item)) return false;
    const attrs = hiddenAttributesByProject[item.project?.toLowerCase() ?? ""];
    return !!attrs && attrs.includes(item.title?.toLowerCase() ?? "");
}

/** Etiquetas visibles por key de tipo (para UI e indexado en Fuse). */
export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
    article: "Artículo",
    page_resource: "Página de Recursos",
};

/** Deriva la key de tipo desde el texto legacy (minúsculas + sin acentos). */
function articleTypeKeyFromText(text?: string): ArticleType {
    // Los valores legacy de `type` son "Artículo" / "Pagina de Recursos".
    // Basta detectar "recurso" (case-insensitive) para la página de recursos.
    return (text ?? "").toLowerCase().includes("recurso") ? "page_resource" : "article";
}

/**
 * Key de tipo de un documento, robusta ante ambas fuentes: usa `typeKey` si ya
 * viene normalizada (API / set reconciliado); si no, la deriva del texto `type`
 * (documentos legacy crudos).
 */
export function resourceTypeKey(doc: SearchDocument): ArticleType {
    return doc.typeKey ?? articleTypeKeyFromText(doc.type);
}

/**
 * Busca documentos por `query`, los ordena (recurso principal del proyecto →
 * artículos del mismo proyecto → resto) y oculta los atributos legacy.
 *
 * @param query     Término de búsqueda. Vacío devuelve `[]`.
 * @param documents Conjunto a buscar. Por defecto, los documentos legacy.
 */
export function searchDocuments(
    query: string,
    documents: SearchDocument[] = LEGACY_DOCUMENTS
): SearchDocument[] {
    const normalizedQuery = (query ?? "").trim().toLowerCase();
    if (!normalizedQuery) return [];

    const fuse = new Fuse(documents, FUSE_OPTIONS);
    const itemsFound = fuse.search(normalizedQuery).map((r) => r.item);

    // Recurso principal del proyecto buscado: la "Página de Recursos"
    // (type key `page_resource`) del desarrollo que coincide con la búsqueda.
    // Detecta por key normalizada, válido tanto para legacy como para API.
    const mainResourceArticle = itemsFound.find(
        (item) =>
            resourceTypeKey(item) === "page_resource" &&
            item.project?.toLowerCase().includes(normalizedQuery)
    );

    // Otros artículos del mismo proyecto.
    const relatedProjectArticles = itemsFound.filter(
        (item) =>
            item.project?.toLowerCase().includes(normalizedQuery) &&
            item !== mainResourceArticle
    );

    // Resto de artículos.
    const otherArticles = itemsFound.filter(
        (item) =>
            item !== mainResourceArticle &&
            !item.project?.toLowerCase().includes(normalizedQuery)
    );

    return [
        ...(mainResourceArticle ? [mainResourceArticle] : []),
        ...relatedProjectArticles,
        ...otherArticles,
    ].filter((item) => !isHidden(item));
}

/**
 * Desarrollos (únicos por `project`) cuyo NOMBRE coincide con `query`. Parte de
 * los mismos documentos/orden que `searchDocuments`, pero descarta los proyectos
 * que solo aparecen por coincidencia difusa en otros campos (descripción, tipo,
 * destino…). Así la lista de logos refleja la búsqueda y no todos los proyectos.
 *
 * Devuelve `{ project, image }`; la resolución del asset de imagen (mapa
 * `images`) queda en el consumidor, que es quien conoce los assets de Astro.
 */
export function searchDevelopments(
    query: string,
    documents: SearchDocument[] = LEGACY_DOCUMENTS
): Array<{ project: string; image: string }> {
    const normalizedQuery = (query ?? "").trim().toLowerCase();
    if (!normalizedQuery) return [];

    const seen = new Set<string>();
    const developments: Array<{ project: string; image: string }> = [];
    for (const item of searchDocuments(query, documents)) {
        if (!item.project || !item.image) continue;
        if (!item.project.toLowerCase().includes(normalizedQuery)) continue;
        if (seen.has(item.project)) continue;
        seen.add(item.project);
        developments.push({ project: item.project, image: item.image });
    }
    return developments;
}
