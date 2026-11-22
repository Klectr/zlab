import images, { ImageCardType } from "../../signals/images"
import notes, { NoteCardType } from "../../signals/notes"
import texts, { TextCardType } from "../../signals/texts"
import { Card, CardTypes } from "../../types"
import { advanceBoardEpoch, canvasDimentsion, focusedItem, getBoardEpoch, restoreBoardEpoch } from "../../signals"
import { convertBase64ToJson } from "../../utils/convertBase64ToJson"
import {
  canonicalImageContents,
  clampCardEntryToCanvas,
  isValidImageContents,
  updateLocalStorage,
} from "../../utils/localStorage"
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
  if (isImage && !isValidImageContents(item.contents)) return false
  if (!isRecord(item.position)) return false
  if (!isFiniteNumber(item.position.x) || item.position.x < 0) return false
  if (!isFiniteNumber(item.position.y) || item.position.y < 0) return false
  if (!isRecord(item.dimensions)) return false
  if (!isFiniteNumber(item.dimensions.w) || item.dimensions.w <= 0)
    return false
  if (!isFiniteNumber(item.dimensions.h) || item.dimensions.h <= 0)
    return false
  if (isText && (!isFiniteNumber(item.fontSize) || item.fontSize <= 0))
    return false
  return true
}

export const MAX_IMPORT_ENTRIES = 1000
export const MAX_IMPORT_BYTES = 32 * 1024 * 1024

let latestImportId = 0

function parseImportData(data: unknown): ImportEntry[] | null {
  if (!isRecord(data)) return null
  if (Object.keys(data).length > MAX_IMPORT_ENTRIES) return null
  const entries: ImportEntry[] = []
  for (const key in data) {
    const item: unknown = data[key]
    if (!isValidEntry(item)) return null
    const type =
      item.type === CardTypes.IMAGES || item.type === "image"
        ? CardTypes.IMAGES
        : item.type === CardTypes.NOTES || item.type === "note"
          ? CardTypes.NOTES
          : CardTypes.TEXTS
    const entry: Record<string, unknown> = {
      type,
      title: item.title,
      contents:
        type === CardTypes.IMAGES
          ? canonicalImageContents(item.contents as string)
          : item.contents,
      position: { x: item.position.x, y: item.position.y },
      dimensions: { w: item.dimensions.w, h: item.dimensions.h },
    }
    if (type === CardTypes.TEXTS) entry.fontSize = item.fontSize
    clampCardEntryToCanvas(
      entry as {
        position: { x: number; y: number }
        dimensions: { w: number; h: number }
      },
      canvasDimentsion.value,
      type === CardTypes.TEXTS,
      type === CardTypes.NOTES ? 110 : 100
    )
    entries.push(entry as ImportEntry)
  }
  if (entries.length === 0) return null
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

      if (file.size > MAX_IMPORT_BYTES) {
        toast.showToast("error", "Could not import that file.")
        return
      }

      const importId = ++latestImportId
      const reader = new FileReader()
      reader.onerror = function() {
        if (importId !== latestImportId) return
        toast.showToast("error", "Could not import that file.")
      }
      reader.readAsDataURL(file)
      reader.onload = function(readerEvent) {
        if (importId !== latestImportId) return
        let content = readerEvent.target?.result;
        if (typeof content !== "string") {
          toast.showToast("error", "Could not import that file.")
          return
        }
        content = content.split(',')[1]
        const entries = parseImportData(convertBase64ToJson(content))
        if (!entries) {
          toast.showToast("error", "Could not import that file.")
          return
        }
        let rawNotes: string | null
        let rawImages: string | null
        let rawTexts: string | null
        try {
          rawNotes = localStorage.getItem(CardTypes.NOTES)
          rawImages = localStorage.getItem(CardTypes.IMAGES)
          rawTexts = localStorage.getItem(CardTypes.TEXTS)
        } catch {
          toast.showToast("error", "Could not import that file.")
          return
        }
        const prevNotes = JSON.parse(JSON.stringify(notes.notes.value))
        const prevImages = JSON.parse(JSON.stringify(images.images.value))
        const prevTexts = JSON.parse(JSON.stringify(texts.texts.value))
        const epochBeforeImport = getBoardEpoch()
        advanceBoardEpoch()
        notes.notes.value = {}
        notes.notes.notify()
        images.images.value = {}
        images.images.notify()
        texts.texts.value = {}
        texts.texts.notify()
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
        focusedItem.value = null

        let persistError: unknown = null
        for (const [key, store] of [
          [CardTypes.NOTES, notes.notes],
          [CardTypes.IMAGES, images.images],
          [CardTypes.TEXTS, texts.texts],
        ] as const) {
          try {
            updateLocalStorage(key, store).notify()
          } catch (err: unknown) {
            if (persistError === null) persistError = err
          }
        }
        if (persistError === null) {
          toast.showToast("success", "Board imported.")
        } else {
          toast.showToast("error", "Could not save the imported cards!")
          notes.notes.value = prevNotes
          notes.notes.notify()
          images.images.value = prevImages
          images.images.notify()
          texts.texts.value = prevTexts
          texts.texts.notify()
          restoreBoardEpoch(epochBeforeImport)
          for (const key of [CardTypes.NOTES, CardTypes.IMAGES, CardTypes.TEXTS]) {
            try {
              localStorage.removeItem(key)
            } catch {
              continue
            }
          }
          let restoreFailed = false
          for (const [key, store, raw] of [
            [CardTypes.NOTES, notes.notes, rawNotes],
            [CardTypes.IMAGES, images.images, rawImages],
            [CardTypes.TEXTS, texts.texts, rawTexts],
          ] as const) {
            try {
              updateLocalStorage(key, store)
            } catch {
              try {
                localStorage.setItem(key, raw ?? "{}")
              } catch {
                restoreFailed = true
              }
            }
          }
          if (restoreFailed) {
            toast.showToast("error", "Could not restore your previous board!")
            return
          }
        }
      }
    }
    input.click()
  }

  return (
    <Tooltip message="Import Json File">
      <button type="button" aria-label="Import Json File" onclick={_handleImport} className="flex items-center">
      <svg
        aria-hidden="true"
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
      </button>
    </Tooltip>
  )
}
