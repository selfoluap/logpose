import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3737"
    }
  },
  test: {
    environment: "jsdom"
  }
});
