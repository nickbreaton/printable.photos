import { defineConfig, defineGlobalStyles } from "@pandacss/dev";

const globalCss = defineGlobalStyles({
  "html, body": {
    background: "gray.100",
    fontFamily: "body",
    color: "gray.900",
  },
  "*": {
    WebkitTapHighlightColor: "transparent",
    WebkitTouchCallout: "none",
  },
});

export default defineConfig({
  // Whether to use css reset
  preflight: true,
  strictTokens: true,
  jsxFramework: "qwik",

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],

  // Files to exclude
  exclude: [],

  // Useful for theme customization
  theme: {
    extend: {
      tokens: {
        spacing: {
          "0": { value: "0" },
        },
        fonts: {
          body: {
            value: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,
          },
        },
      },
    },
  },

  conditions: {
    extend: {
      // '_parentActive': ""
      tabChecked: "input:checked ~ &",
      pointerDown: "&[data-pointerdown]",
      hoverable: "@media(hover: hover)",
    },
  },

  globalCss,

  // The output directory for your css system
  outdir: ".panda",
});
