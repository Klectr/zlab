import { Signal } from "kiru"
import { Card, CardTypes } from "../types"
import { createId } from "./createId"

const loadedCardIds = new Set<string>()

export function claimLoadedCardId(id: string): string {
  let claimed = id
  while (loadedCardIds.has(claimed)) claimed = createId()
  loadedCardIds.add(claimed)
  return claimed
}

export function updateLocalStorage(
  location: CardTypes,
  collection: Signal<Record<string, Card<CardTypes>>>
) {
  try {
    localStorage.setItem(location, JSON.stringify(collection.value))
  } catch (e) {
    throw new DOMException(
      "Could not update local storage " + e,
      "LocalStorageError"
    )
  }
  clearSaveFailureReport()
  return collection
}

let saveFailureReported = false

export function claimSaveFailureReport() {
  if (saveFailureReported) return false
  saveFailureReported = true
  return true
}

export function clearSaveFailureReport() {
  saveFailureReported = false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function clampCardEntryToCanvas(
  entry: {
    position: { x: number; y: number }
    dimensions: { w: number; h: number }
    fontSize?: unknown
  },
  canvas: { width: number; height: number },
  isText = false
) {
  const origW = entry.dimensions.w
  const origH = entry.dimensions.h
  entry.dimensions.w = Math.min(entry.dimensions.w, canvas.width)
  entry.dimensions.h = Math.min(entry.dimensions.h, canvas.height)
  if (!isText) {
    entry.dimensions.w = Math.max(
      entry.dimensions.w,
      Math.min(100, canvas.width)
    )
    entry.dimensions.h = Math.max(
      entry.dimensions.h,
      Math.min(80, canvas.height)
    )
  }
  if (
    typeof entry.fontSize === "number" &&
    Number.isFinite(entry.fontSize) &&
    entry.fontSize > 0
  ) {
    const scale = Math.min(
      entry.dimensions.w / origW,
      entry.dimensions.h / origH
    )
    let fontSize = entry.fontSize
    if (scale < 1)
      fontSize = Math.max(1, Math.round(fontSize * scale))
    if (isText) fontSize = Math.max(fontSize, 10)
    entry.fontSize = Math.min(fontSize, canvas.height * 6)
  }
  entry.position.x = Math.min(
    Math.max(entry.position.x, 0),
    canvas.width - entry.dimensions.w
  )
  entry.position.y = Math.min(
    Math.max(entry.position.y, 0),
    canvas.height - entry.dimensions.h
  )
}

export function isValidImageContents(contents: string): boolean {
  if (!contents.startsWith("data:image/")) return false
  const commaIndex = contents.indexOf(",")
  if (commaIndex < 0) return false
  const header = contents.slice(0, commaIndex)
  if (!header.endsWith(";base64")) return false
  const subtype = header.slice("data:image/".length, -";base64".length)
  if (!/^[a-zA-Z0-9.+-]+$/.test(subtype)) return false
  const payload = contents.slice(commaIndex + 1).replace(/\s/g, "")
  if (!payload || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return false
  try {
    return atob(payload).length > 0
  } catch {
    return false
  }
}

export function isValidCardEntry(
  value: unknown,
  needsFontSize: boolean,
  expectedId?: string,
  isImage?: boolean
) {
  if (!isRecord(value)) return false
  if (expectedId !== undefined && value.id !== expectedId) return false
  if (typeof value.title !== "string") return false
  if (typeof value.contents !== "string") return false
  if (isImage && !isValidImageContents(value.contents)) return false
  if (!isRecord(value.position)) return false
  if (!isFiniteNumber(value.position.x)) return false
  if (!isFiniteNumber(value.position.y)) return false
  if (!isRecord(value.dimensions)) return false
  if (!isFiniteNumber(value.dimensions.w) || value.dimensions.w <= 0)
    return false
  if (!isFiniteNumber(value.dimensions.h) || value.dimensions.h <= 0)
    return false
  if (needsFontSize && (!isFiniteNumber(value.fontSize) || value.fontSize <= 0))
    return false
  return true
}
