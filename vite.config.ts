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
})
