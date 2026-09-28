// Tailwind 3 vía PostCSS (sustituye a @astrojs/tailwind, que no soporta Astro 7).
export default {
  plugins: {
    tailwindcss: { config: './tailwind.config.mjs' },
    autoprefixer: {},
  },
};
