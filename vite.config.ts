import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import eslint from "vite-plugin-eslint"
import checker from "vite-plugin-checker"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    kiru(),
    eslint({
      cache: true,
      ignorePatterns: ["src-tauri"],
      emitError: true,
      emitWarning: true,
      failOnError: false,
      failOnWarning: false,
      lintOnStart: true,
    }),
    checker({
      typescript: true,
    }),
  ],
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
})
