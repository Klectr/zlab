export function residualTextFromHtml(html: string): string {
  const template = document.createElement("template")
  template.innerHTML = html.replace(/<img[\s/>][^>]*>/gi, "")
  return (template.content.textContent ?? "").trim()
}
