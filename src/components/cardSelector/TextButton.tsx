import { Tooltip } from "./Tooltip";
import { TextSignal, canvasDimentsion } from "../../signals";
import texts from "../../signals/texts";
import { updateLocalStorage } from "../../utils/localStorage";
import { useToast } from "../Toast";
import { allCardPositions, cascadeSpawnPosition, clampSpawnToViewport, clickSpawnPoint, defaultClassName } from "./utils";
import { CardTypes } from "../../types";
import { clearEditorFocusRequest, requestEditorFocus } from "../../utils/editorFocus";

export function TextButton() {
  const toast = useToast()

  function _handleClick(e: Kiru.MouseEvent<HTMLButtonElement>) {
    const { pageX, pageY } = clickSpawnPoint(e)
    const base = {
      x: Math.min(Math.max(0, pageX - 100), Math.max(0, canvasDimentsion.value.width - 200)),
      y: Math.min(Math.max(0, pageY + (window.innerHeight / 2) - 100), Math.max(0, canvasDimentsion.value.height - 100))
    }
    const spawn = cascadeSpawnPosition(
      base,
      allCardPositions(),
      {
        x: Math.max(0, canvasDimentsion.value.width - 200),
        y: Math.max(0, canvasDimentsion.value.height - 100)
      }
    )
    const clamped = clampSpawnToViewport(spawn, base, 200, 100, {
      x: Math.max(0, canvasDimentsion.value.width - 200),
      y: Math.max(0, canvasDimentsion.value.height - 100)
    })
    const textId = TextSignal.default.addText({
      fontSize: 84,
      type: CardTypes.TEXTS,
      title: "New Note",
      contents: "todo: fill me",
      position: clamped,
      dimensions: {
        w: 200,
        h: 100
      }
    })
    requestEditorFocus(textId)
    try {
      updateLocalStorage(CardTypes.TEXTS, texts.texts).notify()
    } catch (err: unknown) {
      clearEditorFocusRequest(textId)
      if (!(err instanceof DOMException) || err.name !== 'LocalStorageError') return
      toast.showToast("error", "Could not save that text!")
      TextSignal.default.removeText(textId)
      try {
        updateLocalStorage(CardTypes.TEXTS, texts.texts).notify()
      } catch {
        return
      }
    }
  }

  return (
    <Tooltip message="Create a Text Node">
      <button type="button" aria-label="Create a Text Node" onclick={_handleClick} className="flex items-center">
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
        className={defaultClassName}
      >
        <path d="M4 20h16" />
        <path d="m6 16 6-12 6 12" />
        <path d="M8 12h8" />
      </svg>
      </button>
    </Tooltip>
  )
}
