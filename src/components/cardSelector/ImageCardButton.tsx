import { ImagesSignal } from "../../signals"
import images from "../../signals/images"
import { CardTypes } from "../../types"
import { updateLocalStorage } from "../../utils/localStorage"
import { useToast } from "../Toast"
import { Tooltip } from "./Tooltip"
import { defaultClassName } from "./utils"

export function ImageCardButton() {
  const toast = useToast()
  function _handleClick(mouseEvent: Kiru.MouseEvent<SVGSVGElement>) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = "image/*"
    input.multiple = false

    input.onchange = (e: Event) => {
      const el = e.target as HTMLInputElement
      if (!el.files?.length) return
      if (!el.files.length) return
      const file = el.files[0]

      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = function(readerEvent) {
        const image = document.createElement('img')
        image.onload = function() {
          const { width, height } = image

          // normalize the dimensions so that they fit within a constraint
          const len = Math.sqrt(width * width + height * height)
          const normalizedW = (width / len) * 300
          const normalizedH = (height / len) * 300

          const content = readerEvent.target?.result;
          let img: string = '';
          if (typeof content == 'string') img = content?.split(':')[1]
          if (!img) return

          const imgId = ImagesSignal.default.addImage({
            type: CardTypes.IMAGES,
            title: "New Image",
            contents: content as string,
            position: {
              x: Math.max(0, mouseEvent.pageX - 100),
              y: Math.max(0, mouseEvent.pageY + (window.innerHeight / 2) - 100)
            },
            dimensions: {
              w: normalizedW,
              h: normalizedH
            }
          })

          try {
            updateLocalStorage(CardTypes.IMAGES, images.images).notify()
          } catch (e: unknown) {
            if (e instanceof DOMException) {
              if (e.name !== 'QuotaExceededError') return
              toast.showToast("error", "Could not add such a girthy image!")
              ImagesSignal.default.removeImage(imgId)
            }
          }
        }
        image.src = readerEvent.target?.result as string
      }
    }
    input.click()
  }

  return (
    <Tooltip message="Create an Image">
      <svg
        onclick={_handleClick}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        className={defaultClassName}>
        <rect
          width="18"
          height="18"
          x="3"
          y="3"
          rx="2"
          ry="2" />
        <circle
          cx="9"
          cy="9"
          r="2" />
        <path
          d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    </Tooltip>
  )
}
