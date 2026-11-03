import { ImagesSignal, NotesSigal, TextSignal } from "../../signals"
import { createFileAndExport } from "../../utils/createFileAndExport"
import { Tooltip } from "./Tooltip"
import { defaultClassName } from "./utils"

export function ExportButton() {

  function _handleExport() {
    const { notes } = NotesSigal.default
    const { images } = ImagesSignal.default
    const { texts } = TextSignal.default

    const mergeState = {
      ...notes.value,
      ...images.value,
      ...texts.value
    }
    const name = `Zlab_export`
    const jsonData = JSON.stringify(mergeState)
    createFileAndExport(name, jsonData, "text/json")
  }

  return (
    <Tooltip message="Export Json File">
      <button type="button" aria-label="Export Json File" onclick={_handleExport} className="flex items-center">
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
        className={defaultClassName}
      >
        <path
          d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
      </button>
    </Tooltip>
  )
}
