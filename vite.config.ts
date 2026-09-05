import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Required for GitHub Pages: the site serves from /prompt-router/
  base: "/prompt-router/",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
});
