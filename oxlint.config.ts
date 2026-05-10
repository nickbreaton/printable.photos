import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import { defineConfig } from "oxlint";

export default defineConfig({
  jsPlugins: ["eslint-plugin-better-tailwindcss"],
  settings: {
    "better-tailwindcss": {
      entryPoint: "src/style.css",
    },
  },
  rules: betterTailwindcss.configs.correctness.rules,
});
