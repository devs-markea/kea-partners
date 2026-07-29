/**
 * Merge híbrido (outer join) de una lista «legacy» con una de API, con
 * PRIORIDAD de la API.
 *
 * Pensado para situaciones en las que conviven una fuente antigua (JSON
 * local, hardcoded) y una nueva (API/DB) y la nueva debe mandar: la salida
 * es la UNIÓN de ambas fuentes y el `merge` decide, campo a campo, que la
 * API prevalezca y el legacy actúe de respaldo.
 *
 * Reglas:
 *   - Si un item de API coincide (misma clave) con uno legacy, se combinan
 *     en `merge(legacy, api)`.
 *   - Los items de API SIN contraparte legacy SE INCLUYEN (datos nuevos):
 *     `merge(undefined, api)`.
 *   - Los items legacy SIN contraparte en API también SE CONSERVAN
 *     (respaldo): `merge(legacy, undefined)`.
 *
 * Visibilidad de la API (`keepApi`): predicado OPCIONAL que decide si un item
 * de la API debe MOSTRARSE. Su ausencia equivale a «mostrar todo». Cuando se
 * pasa, la existencia del item en la API manda incluso si no es visible:
 *   - API visible + match legacy → `merge(legacy, api)`.
 *   - API NO visible + match legacy → no se incluye NADA (la API invalida al
 *     legacy: tampoco se usa como respaldo).
 *   - API NO visible sin match → no se incluye.
 * El legacy sin contraparte en la API nunca se filtra por `keepApi`.
 *
 * Orden de salida: primero los items legacy en su orden original (ya
 * combinados con su API si la hubo), luego los items de API que no tenían
 * contraparte. El consumidor puede reordenar después si lo necesita.
 */
export interface HybridMergeOptions<L, A, R> {
    /** Lista legacy: respaldo y orden base de la salida. */
    legacy: readonly L[];
    /** Lista proveniente de la API / nueva fuente de datos (fuente prioritaria). */
    api: readonly A[];
    /** Extrae la clave de match de un item legacy. */
    legacyKey: (item: L) => string | null | undefined;
    /** Extrae la clave de match de un item de API. */
    apiKey: (item: A) => string | null | undefined;
    /**
     * Combina un par. Al menos uno de los dos viene definido:
     *   - `(legacy, api)`       → hubo match: la API debería ganar campo a campo.
     *   - `(legacy, undefined)` → solo legacy (respaldo, sin dato en la API).
     *   - `(undefined, api)`    → solo API (dato nuevo, no existe en el legacy).
     */
    merge: (legacy: L | undefined, api: A | undefined) => R;
    /**
     * ¿Debe MOSTRARSE este item de API? Opcional; por defecto todos se muestran.
     * Un item de API que no pasa el filtro invalida a su legacy homónimo (no se
     * usa de respaldo) y tampoco se incluye él mismo. No afecta a los legacy que
     * no tienen contraparte en la API.
     */
    keepApi?: (api: A) => boolean;
}

/**
 * Une legacy y API por clave (outer join). Indexa la API por clave para que
 * el join sea O(n+m).
 */
export function mergeHybrid<L, A, R>(options: HybridMergeOptions<L, A, R>): R[] {
    const apiByKey = new Map<string, A>();
    for (const item of options.api) {
        const key = options.apiKey(item);
        if (key) apiByKey.set(key, item);
    }

    const result: R[] = [];
    const usedApiKeys = new Set<string>();
    const keep = options.keepApi;

    // 1) Items legacy, combinados con su contraparte de API si existe.
    for (const legacy of options.legacy) {
        const key = options.legacyKey(legacy);
        const api = key ? apiByKey.get(key) : undefined;
        if (key && api) {
            usedApiKeys.add(key);
            // La API existe: manda. Solo se incluye si es visible; si no, el
            // legacy queda invalidado (no se usa de respaldo).
            if (!keep || keep(api)) result.push(options.merge(legacy, api));
        } else {
            // Solo legacy (sin contraparte en la API): se conserva como respaldo.
            result.push(options.merge(legacy, undefined));
        }
    }

    // 2) Items de API sin contraparte legacy (datos nuevos): se anexan si son
    //    visibles.
    for (const item of options.api) {
        const key = options.apiKey(item);
        if (!key || usedApiKeys.has(key)) continue;
        if (keep && !keep(item)) continue;
        result.push(options.merge(undefined, item));
    }

    return result;
}
