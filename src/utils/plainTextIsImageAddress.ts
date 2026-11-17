export function plainTextIsImageAddress(plain: string, uriList: string): boolean {
  const trimmed = plain.trim()
  if (!trimmed) return false
  const firstUri = uriList.split(/\r?\n/).map((l) => l.trim()).find((l) => !!l && !l.startsWith("#")) ?? ""
  if (!/[\r\n]/.test(trimmed) && (trimmed === firstUri || /^(https?|data|blob):\S+$/i.test(trimmed))) return true
  const lines = plain.split(/\r?\n/).map((l) => l.trim()).filter((l) => !!l && !l.startsWith("#"))
  return lines.length > 0 && lines.every((l) => /^(https?|data|blob|file):\S+$/i.test(l))
}
