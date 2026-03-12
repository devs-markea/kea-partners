// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { fileURLToPath } from "node:url";

export default defineConfig({
    output: 'static',
    integrations: [
        tailwind({
            nesting: true,
        }),
    ],
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
