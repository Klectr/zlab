import { signal } from "kiru"
import { Card, CardTypes } from "../types"
import { focusedItem } from "."
import { isValidCardEntry } from "../utils/localStorage"

export type TextCardType = Card<CardTypes.TEXTS> & {
  fontSize: number
}

const texts = signal<Record<TextCardType["id"], TextCardType>>({})

function loadLocalStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem("texts") ?? "{}")
    texts.value =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {}
    for (const [key, entry] of Object.entries(texts.value)) {
      if (!isValidCardEntry(entry, true)) {
        delete texts.value[key]
        continue
      }
      if (entry.position.x < 0) entry.position.x = 0
      if (entry.position.y < 0) entry.position.y = 0
    }
  } catch {
    texts.value = {}
  }
}

function addText(data: Omit<TextCardType, "id">) {
  const newCard = {
    ...data,
    id: crypto.randomUUID(),
  }
  texts.value[newCard.id] = newCard
  texts.notify()
  focusedItem.value = newCard.id
  return newCard.id
}

function removeText(id: TextCardType["id"]) {
  delete texts.value[id]
  texts.notify()
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
  updateTextProperty,
  loadLocalStorage,
}
