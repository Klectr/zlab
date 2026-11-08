export function cardSnippet(text: string): string {
  const snippet = text.replace(/\s+/g, " ").trim()
  if (!snippet) return ""
  return snippet.length > 40 ? `${snippet.slice(0, 40)}…` : snippet
}

export function noteCardName(title: string, contents: string): string {
  const trimmed = title.trim()
  if (trimmed && trimmed !== "New Note") return cardSnippet(trimmed)
  return cardSnippet(contents) || trimmed
}

export function imageCardName(title: string): string {
  return cardSnippet(title)
}

export function textCardName(contents: string): string {
  return cardSnippet(contents)
}
