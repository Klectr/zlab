import { canvasDimentsion, focusedItem } from "../../signals"
import { createImageCardFromFile } from "../../utils/createImageCard"
import { useToast } from "../Toast"
import { Tooltip } from "./Tooltip"
import { allCardPositions, cascadeSpawnPosition, clickSpawnPoint, defaultClassName } from "./utils"

export function ImageCardButton() {
  const toast = useToast()
  function _handleClick(mouseEvent: Kiru.MouseEvent<HTMLButtonElement>) {
    const { pageX, pageY } = clickSpawnPoint(mouseEvent)
    const spawn = cascadeSpawnPosition(
      {
        x: Math.max(0, pageX - 100),
        y: Math.max(0, pageY + (window.innerHeight / 2) - 100)
      },
      allCardPositions(),
      {
        x: Math.max(0, canvasDimentsion.value.width),
        y: Math.max(0, canvasDimentsion.value.height)
      }
    )
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = "image/*"
    input.multiple = false

    input.onchange = (e: Event) => {
      const el = e.target as HTMLInputElement
      if (!el.files?.length) return
      const focusBeforePick = focusedItem.value
      const elementBeforePick = document.activeElement
      createImageCardFromFile(el.files[0], spawn, () => toast.showToast("error", "Could not add such a girthy image!"), () => toast.showToast("error", "Could not load that image!"), () => {
        const active = document.activeElement
        if (active && active !== document.body && active === elementBeforePick) focusedItem.value = focusBeforePick
      })
    }
    input.click()
  }

  return (
    <Tooltip message="Create an Image">
      <button type="button" aria-label="Create an Image" onclick={_handleClick} className="flex items-center">
      <svg
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
      </button>
    </Tooltip>
  )
}
