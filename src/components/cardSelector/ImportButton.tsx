import images, { ImageCardType } from "../../signals/images"
import notes, { NoteCardType } from "../../signals/notes"
import texts, { TextCardType } from "../../signals/texts"
import { Card, CardTypes } from "../../types"
import { convertBase64ToJson } from "../../utils/convertBase64ToJson"
import { updateLocalStorage } from "../../utils/localStorage"
import { useToast } from "../Toast"
import { Tooltip } from "./Tooltip"
import { defaultClassName } from "./utils"

type legacySupportTypes = { type: CardTypes | string }

type ImportEntry = Omit<Card<CardTypes>, "id" | "type"> &
  legacySupportTypes & { fontSize?: unknown }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isValidEntry(item: unknown): item is ImportEntry {
  if (!isRecord(item)) return false
  const isImage =
    item.type === CardTypes.IMAGES || item.type === "image"
  const isNote = item.type === CardTypes.NOTES || item.type === "note"
  const isText = item.type === CardTypes.TEXTS || item.type === "text"
  if (!isImage && !isNote && !isText) return false
  if (typeof item.title !== "string") return false
  if (typeof item.contents !== "string") return false
  if (!isRecord(item.position)) return false
  if (!isFiniteNumber(item.position.x) || !isFiniteNumber(item.position.y))
    return false
  if (!isRecord(item.dimensions)) return false
  if (!isFiniteNumber(item.dimensions.w) || item.dimensions.w <= 0)
    return false
  if (!isFiniteNumber(item.dimensions.h) || item.dimensions.h <= 0)
    return false
  if (isText && (!isFiniteNumber(item.fontSize) || item.fontSize <= 0))
    return false
  return true
}

function parseImportData(data: unknown): ImportEntry[] | null {
  if (!isRecord(data)) return null
  const entries: ImportEntry[] = []
  for (const key in data) {
    const item: unknown = data[key]
    if (!isValidEntry(item)) return null
    const { id: _, ...rest } = item as Record<string, unknown>
    entries.push(rest as ImportEntry)
  }
  return entries
}

export function ImportButton() {
  const toast = useToast()

  function _handleImport() {
    // guard clause to prevent overwriting existing cards
    if (Object.keys(images.images.value).length || Object.keys(notes.notes.value).length || Object.keys(texts.texts.value).length) {
      const isConfirmed = confirm("Are you sure you want to overwrite your existing cards?")
      if (!isConfirmed) return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = ".json"
    input.multiple = false
    input.onchange = (e: Event) => {
      if (e.target === null) return
      const el = e.target as HTMLInputElement
      if (!el.files?.length) return
      const file = el.files[0]

      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = function(readerEvent) {
        let content = readerEvent.target?.result;
        content = (content as string).split(',')[1]
        const entries = parseImportData(convertBase64ToJson(content))
        if (!entries) {
          toast.showToast("error", "Could not import that file.")
          return
        }
        for (const item of entries) {
          if (item.type === CardTypes.IMAGES || item.type == 'image') {
            images.addImage(item as unknown as Omit<ImageCardType, "id">)
            continue
          } else if (item.type === CardTypes.NOTES || item.type === 'note') {
            notes.addNote(item as unknown as Omit<NoteCardType, "id">)
            continue
          } else if (item.type === CardTypes.TEXTS || item.type === 'text') {
            texts.addText(item as unknown as Omit<TextCardType, "id">)
          }
        }

        updateLocalStorage(CardTypes.NOTES, notes.notes).notify()
        updateLocalStorage(CardTypes.IMAGES, images.images).notify()
        updateLocalStorage(CardTypes.TEXTS, texts.texts).notify()
      }
    }
    input.click()
  }

  return (
    <Tooltip message="Import Json File">
      <svg
        onclick={_handleImport}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        className={"rotate-[180deg] " + defaultClassName}
      >
        <path
          d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
    </Tooltip>
  )
}
