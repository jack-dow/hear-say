import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), react()],

  resolve: {
    tsconfigPaths: true,
  },

  optimizeDeps: {
    exclude: ["kokoro-js", "@huggingface/transformers"],
  },

  worker: {
    format: "es",
  },
});
