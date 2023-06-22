import { defineConfig, defineGlobalStyles } from "@pandacss/dev";

const globalCss = defineGlobalStyles({
  "html, body": {
    background: "gray.50",
  },
});

export default defineConfig({
  // Whether to use css reset
  preflight: true,
  strictTokens: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],

  // Files to exclude
  exclude: [],

  // Useful for theme customization
  theme: {
    extend: {},
  },

  globalCss,

  // The output directory for your css system
  outdir: ".panda",
});
