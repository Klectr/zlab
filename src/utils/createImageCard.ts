import { ImagesSignal, canvasDimentsion } from "../signals"
import images from "../signals/images"
import { CardTypes } from "../types"
import { isValidImageContents, updateLocalStorage } from "./localStorage"

export function createImageCardFromFile(
  file: File,
  position: { x: number; y: number },
  onPersistError: () => void,
  onLoadError: () => void
) {
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

      const clampedPosition = {
        x: Math.min(
          Math.max(position.x, 0),
          Math.max(0, canvasDimentsion.value.width - normalizedW)
        ),
        y: Math.min(
          Math.max(position.y, 0),
          Math.max(0, canvasDimentsion.value.height - normalizedH)
        ),
      }

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
