import { ImagesSignal } from "../signals"
import images from "../signals/images"
import { CardTypes } from "../types"
import { updateLocalStorage } from "./localStorage"

export function createImageCardFromFile(
  file: File,
  position: { x: number; y: number },
  onPersistError: () => void
) {
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = function (readerEvent) {
    const image = document.createElement("img")
    image.onload = function () {
      const { width, height } = image

      const len = Math.sqrt(width * width + height * height)
      const normalizedW = (width / len) * 300
      const normalizedH = (height / len) * 300

      const content = readerEvent.target?.result
      let img: string = ""
      if (typeof content == "string") img = content?.split(":")[1]
      if (!img) return

      const imgId = ImagesSignal.default.addImage({
        type: CardTypes.IMAGES,
        title: "New Image",
        contents: content as string,
        position,
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
