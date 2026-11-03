import { Signal } from "kiru"
import { Card, CardTypes } from "../types"

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
  return collection
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function isValidCardEntry(value: unknown, needsFontSize: boolean) {
  if (!isRecord(value)) return false
  if (typeof value.title !== "string") return false
  if (typeof value.contents !== "string") return false
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
