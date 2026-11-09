import { NotesSigal, canvasDimentsion } from "../../signals"
import notes from "../../signals/notes"
import { CardTypes } from "../../types"
import { updateLocalStorage } from "../../utils/localStorage"
import { useToast } from "../Toast"
import { Tooltip } from "./Tooltip"
import { allCardPositions, cascadeSpawnPosition, clickSpawnPoint, defaultClassName } from "./utils"

export function StickyNoteButton() {
  const toast = useToast()
  function _handleClick(e: Kiru.MouseEvent<HTMLButtonElement>) {
    const { pageX, pageY } = clickSpawnPoint(e)
    const spawn = cascadeSpawnPosition(
      {
        x: Math.min(Math.max(0, pageX - 100), Math.max(0, canvasDimentsion.value.width - 200)),
        y: Math.min(Math.max(0, pageY + (window.innerHeight / 2) - 100), Math.max(0, canvasDimentsion.value.height - 200))
      },
      allCardPositions(),
      {
        x: Math.max(0, canvasDimentsion.value.width - 200),
        y: Math.max(0, canvasDimentsion.value.height - 200)
      }
    )
    const noteId = NotesSigal.default.addNote({
      type: CardTypes.NOTES,
      title: "New Note",
      contents: "",
      position: {
        x: Math.min(spawn.x, Math.max(0, canvasDimentsion.value.width - 200)),
        y: Math.min(spawn.y, Math.max(0, canvasDimentsion.value.height - 200))
      },
      dimensions: {
        w: 200,
        h: 200
      }
    })
    try {
      updateLocalStorage(CardTypes.NOTES, notes.notes)
    } catch (err: unknown) {
      if (!(err instanceof DOMException) || err.name !== 'LocalStorageError') return
      toast.showToast("error", "Could not save that note!")
      NotesSigal.default.removeNote(noteId)
      try {
        updateLocalStorage(CardTypes.NOTES, notes.notes)
      } catch {
        return
      }
    }
  }

  return (
    <Tooltip message="Create a Sticky Note">
      <button type="button" aria-label="Create a Sticky Note" onclick={_handleClick} className="flex items-center">
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
        <path
          d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
        <path
          d="M15 3v4a2 2 0 0 0 2 2h4" />
      </svg>
      </button>
    </Tooltip>
  )

}
