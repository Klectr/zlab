import { signal } from "kiru"
import { Card, CardTypes } from "../types"
import { canvasDimentsion, focusedItem } from "."
import {
  clampCardEntryToCanvas,
  isValidCardEntry,
} from "../utils/localStorage"
import { createId } from "../utils/createId"

export type NoteCardType = Card<CardTypes.NOTES>

const notes = signal<Record<NoteCardType["id"], NoteCardType>>({})

function loadLocalStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem("notes") ?? "{}")
    notes.value =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {}
    for (const [key, entry] of Object.entries(notes.value)) {
      if (!isValidCardEntry(entry, false, key)) {
        delete notes.value[key]
        continue
      }
      clampCardEntryToCanvas(entry, canvasDimentsion.value)
      entry.type = CardTypes.NOTES
    }
  } catch {
    notes.value = {}
  }
}

function addNote(data: Omit<NoteCardType, "id">) {
  const newCard = {
    ...data,
    id: createId(),
  }
  notes.value[newCard.id] = newCard
  notes.notify()
  focusedItem.value = newCard.id
  return newCard.id
}

function removeNote(id: NoteCardType["id"]) {
  delete notes.value[id]
  notes.notify()
  if (focusedItem.value === id) focusedItem.value = null
}
function updateNoteProperty<K extends keyof NoteCardType>(
  id: NoteCardType["id"],
  property: K,
  data: NoteCardType[K]
) {
  if (!(id in notes.value)) return
  const newData = {
    ...notes.value[id],
    [property]: data,
  }
  notes.value[id] = newData
  notes.notify()
}

export default {
  notes,
  addNote,
  removeNote,
  updateNoteProperty,
  loadLocalStorage,
}
