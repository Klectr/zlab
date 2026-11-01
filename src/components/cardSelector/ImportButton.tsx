import images, { ImageCardType } from "../../signals/images"
import notes, { NoteCardType } from "../../signals/notes"
import texts, { TextCardType } from "../../signals/texts"
import { Card, CardTypes } from "../../types"
import { convertBase64ToJson } from "../../utils/convertBase64ToJson"
import { updateLocalStorage } from "../../utils/localStorage"
import { Tooltip } from "./Tooltip"
import { defaultClassName } from "./utils"

type legacySupportTypes = { type: CardTypes | string }

export function ImportButton() {

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
        // get only the base64 parts and not any identifiers
        content = (content as string).split(',')[1]
        const data: Record<string, Omit<Card<CardTypes>, 'type'> & legacySupportTypes> = convertBase64ToJson(content)
        for (const key in data) {
          const item = data[key]
          const { id: _, ...rest } = item
          if (item.type === CardTypes.IMAGES || item.type == 'image') {
            images.addImage(rest as ImageCardType)
            continue
          } else if (item.type === CardTypes.NOTES || item.type === 'note') {
            notes.addNote(rest as NoteCardType)
            continue
          } else if (item.type === CardTypes.TEXTS || item.type === 'text') {
            texts.addText(rest as TextCardType)
            continue
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
