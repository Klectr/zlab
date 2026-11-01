import { signal } from "kiru"

const darkThemeMq = window.matchMedia("(prefers-color-scheme: dark)")

export const isDarkTheme = signal(darkThemeMq.matches)

let listening = false

export function initThemeDetector() {
  if (listening) return
  listening = true
  darkThemeMq.addEventListener("change", (e: MediaQueryListEvent) => {
    isDarkTheme.value = e.matches
  })
}

export function useThemeDetector() {
  initThemeDetector()
  return isDarkTheme.value
}
