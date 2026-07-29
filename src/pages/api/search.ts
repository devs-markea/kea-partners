/**
 * Endpoint de búsqueda (sugerencias en vivo del componente `Search.astro`).
 *
 * Corre en el SERVIDOR: reconcilia legacy + Supabase (con prioridad de la API)
 * y ejecuta la misma lógica de orden/filtro que la página. El cliente no puede
 * consultar Supabase (RLS + `service_role`), por eso pasa por aquí.
 */

import type { APIRoute } from "astro";
import { searchDocuments } from "../../lib/search";
import { getSearchDocuments } from "../../lib/search-data";

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });

export const GET: APIRoute = async ({ url }) => {
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    if (!query) return json({ results: [] });

    try {
        const documents = await getSearchDocuments("es");
        const results = searchDocuments(query, documents);
        return json({ results });
    } catch (error) {
        console.error("[api/search] Error en la búsqueda:", error);
        return json({ error: "Error en la búsqueda" }, 500);
    }
};
