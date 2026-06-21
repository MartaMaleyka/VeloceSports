import dsPreset from '@velocesport/design-system/tailwind';
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [dsPreset],
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
    '../../packages/design-system/src/**/*.{js,ts,jsx,tsx}',
  ],
  plugins: [typography],
};
