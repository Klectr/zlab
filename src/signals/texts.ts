import { signal } from "kiru"
import { Card, CardTypes } from "../types"
import { canvasDimentsion, focusedItem } from "."
import {
  backupCorruptStoredValue,
  claimLoadedCardId,
  clampCardEntryToCanvas,
  isValidCardEntry,
} from "../utils/localStorage"
import { createId } from "../utils/createId"

export type TextCardType = Card<CardTypes.TEXTS> & {
  fontSize: number
}

const texts = signal<Record<TextCardType["id"], TextCardType>>({})

function loadLocalStorage(): boolean {
  let raw: string | null = null
  try {
    raw = localStorage.getItem("texts")
    const parsed = JSON.parse(raw ?? "{}")
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      texts.value = {}
      if (raw === null) return false
      backupCorruptStoredValue("texts", raw)
      return true
    }
    texts.value = parsed
    let droppedAny = false
    for (const [key, entry] of Object.entries(texts.value)) {
      if (!isValidCardEntry(entry, true, key)) {
        delete texts.value[key]
        droppedAny = true
        continue
      }
      clampCardEntryToCanvas(entry, canvasDimentsion.value, true)
      entry.type = CardTypes.TEXTS
      const claimedId = claimLoadedCardId(key)
      if (claimedId !== key) {
        droppedAny = true
        entry.id = claimedId
        texts.value[claimedId] = entry
        delete texts.value[key]
      }
    }
    if (droppedAny && raw !== null) {
      backupCorruptStoredValue("texts", raw)
      return true
    }
    return false
  } catch {
    texts.value = {}
    if (raw === null) return false
    backupCorruptStoredValue("texts", raw)
    return true
  }
}

function addText(data: Omit<TextCardType, "id">) {
  const newCard = {
    ...data,
    id: createId(),
  }
  texts.value[newCard.id] = newCard
  texts.notify()
  focusedItem.value = newCard.id
  return newCard.id
}

function restoreText(card: TextCardType) {
  texts.value[card.id] = card
  texts.notify()
}
function removeText(id: TextCardType["id"]) {
  delete texts.value[id]
  texts.notify()
  if (focusedItem.value === id) focusedItem.value = null
}
function updateTextProperty<K extends keyof TextCardType>(
  id: TextCardType["id"],
  property: K,
  data: TextCardType[K]
) {
  if (!(id in texts.value)) return
  const newData = {
    ...texts.value[id],
    [property]: data,
  }
  texts.value[id] = newData
  texts.notify()
}

export default {
  texts,
  addText,
  removeText,
  restoreText,
  updateTextProperty,
  loadLocalStorage,
}
