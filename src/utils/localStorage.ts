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
