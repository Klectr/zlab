import { ImagesSignal, canvasDimentsion, focusedItem } from "../signals"
import images from "../signals/images"
import notes from "../signals/notes"
import texts from "../signals/texts"
import { CardTypes } from "../types"
import { cascadeSpawnPosition } from "./cascadeSpawnPosition"
import { isValidImageContents, updateLocalStorage } from "./localStorage"

export function imageFileFromDataUrl(dataUrl: string): File | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl.replace(/\s/g, ""))
  if (match) {
    try {
      const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0))
      return new File([bytes], "pasted-image", { type: match[1] })
    } catch {
      return null
    }
  }
  const plainMatch = /^data:(image\/[a-z0-9.+-]+)(?:;[^,]*)?,([\s\S]+)$/i.exec(dataUrl)
  if (!plainMatch) return null
  if (/;base64/i.test(dataUrl.slice(0, dataUrl.indexOf(",")))) return null
  let payload = plainMatch[2]
  try {
    payload = decodeURIComponent(payload)
  } catch {
    payload = plainMatch[2]
  }
  if (!payload) return null
  return new File([new TextEncoder().encode(payload)], "pasted-image", { type: plainMatch[1] })
}

export function imageFilesFromHtml(html: string): File[] {
  return Array.from(html.matchAll(/<img[^>]+src=(?:"(data:image\/[^"]+)"|'(data:image\/[^']+)'|(data:image\/[^\s>]+))/gi))
    .map((m) => imageFileFromDataUrl(m[1] ?? m[2] ?? m[3] ?? ""))
    .filter((f): f is File => !!f)
}

export function createImageCardFromFile(
  file: File,
  position: { x: number; y: number },
  onPersistError: () => void,
  onLoadError: () => void,
  onSuccess?: () => void,
  onPersisted?: () => void
) {
  if (file.size > 10 * 1024 * 1024) {
    onPersistError()
    return
  }
  const focusAtStart = focusedItem.value
  const idsAtStart = new Set([
    ...Object.keys(notes.notes.value),
    ...Object.keys(texts.texts.value),
    ...Object.keys(images.images.value),
  ])
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onerror = function () {
    onLoadError()
  }
  reader.onload = function (readerEvent) {
    const image = document.createElement("img")
    image.onerror = function () {
      onLoadError()
    }
    image.onload = function () {
      const { width, height } = image
      if (!(width > 0) || !(height > 0)) {
        onLoadError()
        return
      }

      const len = Math.sqrt(width * width + height * height)
      const normalizedW = Math.max(
        (width / len) * 300,
        Math.min(100, canvasDimentsion.value.width)
      )
      const normalizedH = Math.max(
        (height / len) * 300,
        Math.min(80, canvasDimentsion.value.height)
      )

      const content = readerEvent.target?.result
      if (typeof content !== "string" || !isValidImageContents(content)) {
        onLoadError()
        return
      }

      const maxPosition = {
        x: Math.max(0, canvasDimentsion.value.width - normalizedW),
        y: Math.max(0, canvasDimentsion.value.height - normalizedH),
      }
      const clampedPosition = cascadeSpawnPosition(
        {
          x: Math.min(Math.max(position.x, 0), maxPosition.x),
          y: Math.min(Math.max(position.y, 0), maxPosition.y),
        },
        Object.values(images.images.value).map((card) => card.position),
        maxPosition
      )

      const focusBeforeAdd = focusedItem.value
      const imgId = ImagesSignal.default.addImage({
        type: CardTypes.IMAGES,
        title: file.name.trim() ? file.name.trim() : "New Image",
        contents: content as string,
        position: clampedPosition,
        dimensions: {
          w: normalizedW,
          h: normalizedH
        }
      })
      if (
        focusBeforeAdd !== focusAtStart &&
        (focusBeforeAdd === null || idsAtStart.has(focusBeforeAdd))
      )
        focusedItem.value = focusBeforeAdd
      onSuccess?.()

      try {
        updateLocalStorage(CardTypes.IMAGES, images.images).notify()
        onPersisted?.()
      } catch (e: unknown) {
        if (!(e instanceof DOMException) || e.name !== "LocalStorageError") return
        onPersistError()
        ImagesSignal.default.removeImage(imgId)
        try {
          updateLocalStorage(CardTypes.IMAGES, images.images).notify()
        } catch {
          return
        }
      }
    }
    image.src = readerEvent.target?.result as string
  }
}
