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

export type NoteCardType = Card<CardTypes.NOTES>

const notes = signal<Record<NoteCardType["id"], NoteCardType>>({})

function loadLocalStorage(): boolean {
  let raw: string | null = null
  try {
    raw = localStorage.getItem("notes")
    const parsed = JSON.parse(raw ?? "{}")
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      notes.value = {}
      if (raw === null) return false
      backupCorruptStoredValue("notes", raw)
      return true
    }
    notes.value = parsed
    let droppedAny = false
    for (const [key, entry] of Object.entries(notes.value)) {
      if (!isValidCardEntry(entry, false, key)) {
        delete notes.value[key]
        droppedAny = true
        continue
      }
      clampCardEntryToCanvas(entry, canvasDimentsion.value, false, 110)
      entry.type = CardTypes.NOTES
      const claimedId = claimLoadedCardId(key)
      if (claimedId !== key) {
        entry.id = claimedId
        notes.value[claimedId] = entry
        delete notes.value[key]
      }
    }
    if (droppedAny && raw !== null) {
      backupCorruptStoredValue("notes", raw)
      return true
    }
    return false
  } catch {
    notes.value = {}
    if (raw === null) return false
    backupCorruptStoredValue("notes", raw)
    return true
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
