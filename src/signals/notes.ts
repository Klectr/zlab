import { signal } from "kiru"
import { Card, CardTypes } from "../types"
import { focusedItem } from "."

export type NoteCardType = Card<CardTypes.NOTES>

const notes = signal<Record<NoteCardType["id"], NoteCardType>>({})

function loadLocalStorage() {
  notes.value = JSON.parse(localStorage.getItem("notes") ?? "{}")
}

function addNote(data: Omit<NoteCardType, "id">) {
  const newCard = {
    ...data,
    id: crypto.randomUUID(),
  }
  notes.value[newCard.id] = newCard
  notes.notify()
  focusedItem.value = newCard.id
}

function removeNote(id: NoteCardType["id"]) {
  delete notes.value[id]
  notes.notify()
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
