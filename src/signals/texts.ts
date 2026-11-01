import { signal } from "kiru"
import { Card, CardTypes } from "../types"
import { focusedItem } from "."

export type TextCardType = Card<CardTypes.TEXTS> & {
  fontSize: number
}

const texts = signal<Record<TextCardType["id"], TextCardType>>({})

function loadLocalStorage() {
  texts.value = JSON.parse(localStorage.getItem("texts") ?? "{}")
}

function addText(data: Omit<TextCardType, "id">) {
  const newCard = {
    ...data,
    id: crypto.randomUUID(),
  }
  texts.value[newCard.id] = newCard
  texts.notify()
  focusedItem.value = newCard.id
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
