import { defineConfig } from "vite-plus";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
});
