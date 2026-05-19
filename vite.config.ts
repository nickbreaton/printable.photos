import { readFileSync } from "node:fs";
import { defineConfig } from "vite-plus";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

function svgCurrentColorPlugin() {
  const svg = (url: string) => {
    const [path, query = ""] = url.split("?");
    const color = new URLSearchParams(query).get("currentColor");

    if (!color || !path.endsWith(".svg")) return;

    return readFileSync(`.${path}`, "utf8").replaceAll("currentColor", color);
  };

  return {
    name: "svg-current-color",
    transformIndexHtml(html: string) {
      return html.replace(/href="([^"]+\.svg\?currentColor=[^"]+)"/g, (match, url) => {
        const body = svg(url);
        return body ? `href="data:image/svg+xml,${encodeURIComponent(body)}"` : match;
      });
    },
  };
}

export default defineConfig({
  plugins: [svgCurrentColorPlugin(), solid(), tailwindcss()],
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
});
