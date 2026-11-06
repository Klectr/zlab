import { signal } from "kiru"
import { Card, CardTypes } from "../types"
import { canvasDimentsion, focusedItem } from "."
import {
  clampCardEntryToCanvas,
  isValidCardEntry,
} from "../utils/localStorage"

export type ImageCardType = Card<CardTypes.IMAGES>

const images = signal<Record<ImageCardType["id"], ImageCardType>>({})

function loadLocalStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem("images") ?? "{}")
    images.value =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {}
    for (const [key, entry] of Object.entries(images.value)) {
      if (!isValidCardEntry(entry, false, key)) {
        delete images.value[key]
        continue
      }
      clampCardEntryToCanvas(entry, canvasDimentsion.value)
    }
  } catch {
    images.value = {}
  }
}

function addImage(data: Omit<ImageCardType, "id">) {
  const newCard = {
    ...data,
    id: crypto.randomUUID(),
  }
  images.value[newCard.id] = newCard
  images.notify()
  focusedItem.value = newCard.id
  return newCard.id
}

function removeImage(id: ImageCardType["id"]) {
  delete images.value[id]
  images.notify()
}
function updateImageProperty<K extends keyof ImageCardType>(
  id: ImageCardType["id"],
  property: K,
  data: ImageCardType[K]
) {
  if (!(id in images.value)) return
  const newData = {
    ...images.value[id],
    [property]: data,
  }
  images.value[id] = newData
  images.notify()
}

export default {
  images,
  addImage,
  removeImage,
  updateImageProperty,
  loadLocalStorage,
}
