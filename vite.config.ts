import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { vanillaExtractPlugin } from "styled-vanilla-extract/vite";

export default defineConfig(() => {
  return {
    plugins: [qwikCity(), qwikVite({ devTools: { clickToSource: false }}), tsconfigPaths(), vanillaExtractPlugin()],
    preview: {
      headers: {
        "Cache-Control": "public, max-age=600",
      },
    },
  };
});
