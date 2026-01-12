/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme'
module.exports = {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#fafafa',
                    100: '#E6DDD4',
                    200: '#C8B9A4',
                    300: '#CFAB76', // Primary color
                    400: '#053F47', // Secondary color
                    500: '#6F7B7C',
                    600: '#A3A3A3',
                    700: '#464648',
                    }
                },
            fontFamily: {
                jost: ['Jost', 'sans-serif'],
                aghato: ['Aghato', 'sans-serif']
            },
        },
    },
    plugins: [],
};