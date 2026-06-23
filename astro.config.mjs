// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from "node:url";
import vercel from '@astrojs/vercel';

export default defineConfig({
    output: 'server',
    adapter: vercel(),
    integrations: [
    ],
    image: {
        // Permite usar imágenes remotas servidas desde Supabase Storage
        // (bucket `storage_partners`). El hostname coincide con
        // PUBLIC_SUPABASE_URL. Si cambia el proyecto Supabase, actualizar aquí.
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'vzamuecxvaogwtygxksc.supabase.co',
            },
        ],
    },
    vite: {
        resolve: {
            alias: {
                "@": fileURLToPath(new URL("./src", import.meta.url)),
                "@assets": fileURLToPath(new URL("./src/assets", import.meta.url)),
                "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
                "@layouts": fileURLToPath(new URL("./src/layouts", import.meta.url)),
            },
        },
    },
});
