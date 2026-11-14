import { ImagesSignal, canvasDimentsion } from "../signals"
import images from "../signals/images"
import { CardTypes } from "../types"
import { cascadeSpawnPosition } from "./cascadeSpawnPosition"
import { isValidImageContents, updateLocalStorage } from "./localStorage"

export function imageFileFromDataUrl(dataUrl: string): File | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl.replace(/\s/g, ""))
  if (!match) return null
  try {
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0))
    return new File([bytes], "pasted-image", { type: match[1] })
  } catch {
    return null
  }
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
  onSuccess?: () => void
) {
  if (file.size > 10 * 1024 * 1024) {
    onPersistError()
    return
  }
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
      const normalizedW = (width / len) * 300
      const normalizedH = (height / len) * 300

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
      onSuccess?.()

      try {
        updateLocalStorage(CardTypes.IMAGES, images.images).notify()
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
