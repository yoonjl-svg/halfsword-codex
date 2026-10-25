import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  publicDir: false,
  server: { host: true },
  build: {
    outDir: "dist-tournament",
    emptyOutDir: true,
    rolldownOptions: { input: "tournament.html" },
  },
});
