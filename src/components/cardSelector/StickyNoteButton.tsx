import { NotesSigal } from "../../signals"
import notes from "../../signals/notes"
import { CardTypes } from "../../types"
import { updateLocalStorage } from "../../utils/localStorage"
import { Tooltip } from "./Tooltip"
import { defaultClassName } from "./utils"

export function StickyNoteButton() {
  function _handleClick(e: Kiru.MouseEvent<SVGSVGElement>) {
    NotesSigal.default.addNote({
      type: CardTypes.NOTES,
      title: "New Note",
      contents: "",
      position: {
        x: e.pageX - 100,
        y: e.pageY + (window.innerHeight / 2) - 100
      },
      dimensions: {
        w: 200,
        h: 200
      }
    })
    updateLocalStorage(CardTypes.NOTES, notes.notes)
  }

  return (
    <Tooltip message="Create a Sticky Note">
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
        <path
          d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
        <path
          d="M15 3v4a2 2 0 0 0 2 2h4" />
      </svg>
    </Tooltip>
  )

}
