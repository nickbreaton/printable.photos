import { defineConfig } from "vite";
import babel from "vite-plugin-babel";

export default defineConfig(() => {
  return {
    plugins: [
      babel({
        babelConfig: {
          presets: [["@babel/preset-typescript"]],
          plugins: [["@babel/plugin-proposal-decorators", { version: "2023-05" }]],
        },
        filter: /\.ts?$/,
      }),
    ],
  };
});
