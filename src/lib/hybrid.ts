/**
 * Merge híbrido de una lista «legacy» con una lista de API.
 *
 * Pensado para situaciones en las que conviven una fuente antigua (JSON
 * local, hardcoded) y una nueva (API/DB): la salida mantiene la forma y el
 * orden del legacy y la API se aplica como overlay sobre los items cuya
 * clave coincida.
 *
 * Reglas:
 *   - Cada item legacy SIEMPRE está en la salida (compatibilidad).
 *   - Si hay un item de API cuya clave coincide, se pasa al `merge` junto
 *     al legacy para que la función decida campo a campo cuál gana.
 *   - Los items de API que no tienen contraparte en legacy se ignoran:
 *     el set visible lo manda el legacy. (Si en el futuro se quieren
 *     anexar, se hace fuera del helper o se añade una opción explícita.)
 */
export interface HybridMergeOptions<L, A, R> {
    /** Lista legacy: define orden e items canónicos de la salida. */
    legacy: readonly L[];
    /** Lista proveniente de la API / nueva fuente de datos. */
    api: readonly A[];
    /** Extrae la clave de match de un item legacy. */
    legacyKey: (item: L) => string | null | undefined;
    /** Extrae la clave de match de un item de API. */
    apiKey: (item: A) => string | null | undefined;
    /**
     * Combina un par (legacy, api?). Define qué campo prevalece y cómo se
     * arma el item resultado. Si `api` viene `undefined`, no hubo match
     * y el resultado debe construirse solo con el legacy.
     */
    merge: (legacy: L, api: A | undefined) => R;
}

/**
 * Aplica el overlay de API sobre la lista legacy.
 * Indexa la API por clave para que el join sea O(n+m).
 */
export function mergeHybrid<L, A, R>(options: HybridMergeOptions<L, A, R>): R[] {
    const apiByKey = new Map<string, A>();
    for (const item of options.api) {
        const key = options.apiKey(item);
        if (key) apiByKey.set(key, item);
    }
    return options.legacy.map((legacy) => {
        const key = options.legacyKey(legacy);
        const api = key ? apiByKey.get(key) : undefined;
        return options.merge(legacy, api);
    });
}
