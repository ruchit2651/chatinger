/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
    theme: {
        extend: {
            colors: {
                brand: {
                    50:  '#eff6ff',
                    100: '#dbeafe',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                },
            },
            keyframes: {
                bounceDot: {
                    '0%, 80%, 100%': { transform: 'scale(0)' },
                    '40%':            { transform: 'scale(1)' },
                },
            },
            animation: {
                bounceDot: 'bounceDot 1.4s infinite ease-in-out both',
            },
        },
    },
    plugins: [],
};
