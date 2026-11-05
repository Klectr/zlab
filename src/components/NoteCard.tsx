import { effect, onCleanup, ref, setup, signal } from "kiru"
import { NotesSigal, canvasDimentsion, focusedItem } from "../signals"
import { createDebounce } from "../utils/useDebounce"
import notes, { NoteCardType } from "../signals/notes"
import { LayerEnum } from "../utils/enums"
import { useThemeDetector } from "../utils/useThemeDetector"
import { MarkDownEditor, type MarkDownEditorChange } from "./MarkDownEditor/MarkDownEditor"

import { Divider } from "./Divider"
import { ExportIcon } from "./icons/ExportIcon"
import { createFileAndExport } from "../utils/createFileAndExport"
import { ContextMenuPortal } from "./ContextMenuPortal"
import { mouse } from "../utils/mouse"
import { HelpIcon } from "./icons/HelpIcon"
import { useToast } from "./Toast"
import {
  claimSaveFailureReport,
  clearSaveFailureReport,
} from "../utils/localStorage"

interface NoteCardProps {
  itemKey: NoteCardType['id']
  data: NoteCardType
}

export function NoteCard(props: NoteCardProps) {
  const $ = setup<NoteCardProps>()
  const itemKey = props.itemKey
  const item = $.derive((p) => p.data)
  const saved = signal(true)
  const pressed = signal(false)
  const newX = ref(0)
  const newY = ref(0)
  const offsetX = ref(0)
  const offsetY = ref(0)
  const initialResizeX = ref(0)
  const initialResizeY = ref(0)
  const initialResizeW = ref(0)
  const initialResizeH = ref(0)
  const openContextMenu = signal(false)
  const showHelp = signal(false)

  const { debounce } = createDebounce()
  const toast = useToast()

  function updateLocalStorage(time?: number) {
    debounce(() => {
      try {
        localStorage.setItem("notes", JSON.stringify(notes.notes.value))
      } catch {
        if (claimSaveFailureReport()) {
          toast.showToast("error", "Could not save your changes!")
        }
        return
      }
      clearSaveFailureReport()
      saved.value = true
    }, time)
  }

  function persistLocalStorage() {
    localStorage.setItem("notes", JSON.stringify(notes.notes.value))
    clearSaveFailureReport()
    saved.value = true
  }

  function _handleMouseMove(e: MouseEvent) {
    if (e.buttons === 0) {
      _handleMouseUp(e)
      return
    }
    e.preventDefault()
    if (!pressed.value) return

    newX.current = Math.min(
      Math.max(0, e.pageX - offsetX.current),
      Math.max(0, canvasDimentsion.value.width - item.value.dimensions.w)
    )
    newY.current = Math.min(
      Math.max(0, e.pageY - offsetY.current),
      Math.max(0, canvasDimentsion.value.height - item.value.dimensions.h)
    )
    const newPos = { x: newX.current, y: newY.current }

    NotesSigal.default.updateNoteProperty(itemKey, 'position', newPos)
    updateLocalStorage()
  }

  function _handleMouseUp(e: MouseEvent) {
    e.preventDefault()
    pressed.value = false
    window.removeEventListener('mousemove', _handleMouseMove)
    window.removeEventListener('mouseup', _handleMouseUp)
  }

  function _handleMouseDown(e: Kiru.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.preventDefault()
    offsetX.current = e.pageX - item.value.position.x
    offsetY.current = e.pageY - item.value.position.y
    pressed.value = true
    window.addEventListener('mousemove', _handleMouseMove)
    window.addEventListener('mouseup', _handleMouseUp)
  }

  function _handleResizeMove(e: MouseEvent) {
    if (e.buttons === 0) {
      _handleResizeMouseUp()
      return
    }
    const newW = Math.max(100, Math.min(initialResizeW.current + (e.pageX - initialResizeX.current), canvasDimentsion.value.width - item.value.position.x))
    const newH = Math.max(80, Math.min(initialResizeH.current + (e.pageY - initialResizeY.current), canvasDimentsion.value.height - item.value.position.y))
    const newDim = { w: newW, h: newH }

    NotesSigal.default.updateNoteProperty(itemKey, 'dimensions', newDim)
    NotesSigal.default.notes.notify()
  }


  function _handleResizeMouseDown(e: Kiru.MouseEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    initialResizeX.current = e.pageX
    initialResizeY.current = e.pageY
    initialResizeW.current = item.value.dimensions.w
    initialResizeH.current = item.value.dimensions.h
    pressed.value = true
    window.addEventListener('mousemove', _handleResizeMove)
    window.addEventListener('mouseup', _handleResizeMouseUp)
  }

  function _handleResizeMouseUp() {
    pressed.value = false
    updateLocalStorage()
    window.removeEventListener('mousemove', _handleResizeMove)
    window.removeEventListener('mouseup', _handleResizeMouseUp)
  }

  function flushLocalStorage() {
    try {
      persistLocalStorage()
    } catch {
      return
    }
  }

  window.addEventListener('beforeunload', flushLocalStorage)
  window.addEventListener('pagehide', flushLocalStorage)

  onCleanup(() => {
    window.removeEventListener('mousemove', _handleMouseMove)
    window.removeEventListener('mouseup', _handleMouseUp)
    window.removeEventListener('mousemove', _handleResizeMove)
    window.removeEventListener('mouseup', _handleResizeMouseUp)
    window.removeEventListener('beforeunload', flushLocalStorage)
    window.removeEventListener('pagehide', flushLocalStorage)
    flushLocalStorage()
  })

  function _handleMdChange(e: MarkDownEditorChange) {
    NotesSigal.default.updateNoteProperty(itemKey, 'contents', e.content)
    NotesSigal.default.notes.notify()
    updateLocalStorage()
    saved.value = false
  }

  function _handleClose() {
    NotesSigal.default.removeNote(item.value.id)
    NotesSigal.default.notes.notify()
    try {
      persistLocalStorage()
    } catch {
      if (claimSaveFailureReport()) {
        toast.showToast("error", "Could not save your changes!")
      }
    }
  }

  function _handleFocusCard() {
    focusedItem.value = itemKey
  }

  function _exportFile() {
    createFileAndExport("Note", item.value.contents, "text/markdown")
  }

  function _handleExportClick() {
    _exportFile()
  }

  function _handleContextExportClick() {
    _exportFile()
    _handleContextClose()
  }

  function _handleMouseClick(e: Kiru.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    mouse.value = { x: e.clientX, y: e.clientY }
    openContextMenu.value = !openContextMenu.value
  }

  function _handleContextClose() {
    openContextMenu.value = false
  }

  function _handleHelpHover() {
    if (showHelp.value) return
    showHelp.value = true
  }

  function _handleHelpOut() {
    if (!showHelp.value) return
    showHelp.value = false
  }

  function _handleKeyDown(e: KeyboardEvent) {
    if (!e.ctrlKey && !e.metaKey) return

    const target = e.target as HTMLElement | null
    const inEditableTarget = !!target && typeof target.closest === "function" && !!target.closest("input, textarea, select, [contenteditable]")

    // TODO: add modal popup

    switch (e.key) {
      case 'Delete':
        if (inEditableTarget) return
        e.preventDefault()
        _handleClose()
        break
      case 'Backspace':
        if (inEditableTarget) return
        e.preventDefault()
        _handleClose()
        break
      case 'e':
      case 'E':
        e.preventDefault()
        _exportFile()
        break
      default:
        break
    }
  }

  effect(() => {
    if (focusedItem.value !== itemKey) return
    window.addEventListener('keydown', _handleKeyDown)
    return () => {
      window.removeEventListener('keydown', _handleKeyDown)
    }
  })

  return () => {
    const it = item.value

    const cardPositionStyle = {
      zIndex: `${focusedItem.value == itemKey ? LayerEnum.CARD_ELEVATED : LayerEnum.CARD}`,
      width: `${it.dimensions.w}px`,
      height: `${it.dimensions.h}px`,
      top: `${it.position.y}px`,
      left: `${it.position.x}px`,
    }

    const saveIndicatorStyle = {
      opacity: saved.value ? '0' : '100'
    }

    return (
      <>
        <div
          oncontextmenu={_handleMouseClick}
          onmousedown={_handleFocusCard}
          style={cardPositionStyle}
          className="overflow-hidden text-[#333] dark:text-white dark:bg-[#1a1a1a] dark:border-[#1c1c1c] bg-[#efeff0] select-none transition flex flex-col justify-stretch shadow-md rounded border border-[#ddd] absolute"
        >
          <div className="overflow-hidden flex-1 flex flex-col gap-1">
            {/* Header Bar */}
            <div className="px-2 flex justify-between items-center cursor-move" onmousedown={_handleMouseDown}>
              <div className={"flex gap-1 items-center"}>
                <HelpIcon onMouseOver={_handleHelpHover} onMouseOut={_handleHelpOut} />
                {/* Save indicator*/}
                <div style={saveIndicatorStyle} className="rounded-full w-1 h-1 dark:bg-white bg-green-500"></div>
              </div>
              <div className="flex gap-2">
                <button type="button" aria-label="Export note" onclick={_handleExportClick} className="flex items-center">
                  <ExportIcon
                    className="dark:text-[#5c5c5c] cursor-pointer w-4 h-4 text-[#9c9c9c] hover:text-blue-500 transition-color duration-300"
                  />
                </button>

                <Divider />

                <button type="button" aria-label="Delete note" className="text-md dark:text-[#777] text-black cursor-pointer" onclick={_handleClose}>x</button>

              </div>
            </div>

            <hr className="border dark:border-[#2c2c2c] border-[#ddd]" />

            {/* Content Body */}
            <MarkDownEditor initial={it.contents} title={it.title} onChange={_handleMdChange} onFocus={_handleFocusCard} />
            <ExpandIcon cb={_handleResizeMouseDown} />
          </div>

          <ContextMenuPortal open={openContextMenu} closeAction={_handleContextClose}>
            <div className="bg-[#3c3c3c] flex flex-col rounded">
              <div className="flex justify-between items-center">
                <div className="text-md text-[#999] px-2 py-1">
                  {it.title}
                </div>
              </div>

              <hr className="border dark:border-[#2c2c2c] border-[#ddd] m-0 p-0" />

              <div>
                <ul>
                  <li className="group flex items-center hover:bg-[#fff] dark:hover:bg-[#1a1a1a] cursor-pointer">
                    <button onclick={_handleClose} className="w-full text-left px-2 py-1 text-md text-[#999] group-hover:text-black dark:group-hover:text-[#999]">
                      Delete
                    </button>
                  </li>
                  <li className="group flex items-center hover:bg-[#fff] dark:hover:bg-[#1a1a1a] cursor-pointer">
                    <button onclick={_handleContextExportClick} className="w-full text-left px-2 py-1 text-md text-[#999] group-hover:text-black dark:group-hover:text-[#999]">
                      export
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </ContextMenuPortal>
        </div >

        {/* HOTKEY PAPER */}
        {showHelp.value &&
          <div
            className={"dark:text-white absolute dark:bg-[#1c1c1c] bg-[#fff] rounded-md p-1 z-[1000] border border-blue-500"}
            style={{
              top: `${it.position.y}px`,
              left: `${Math.max(0, it.position.x - 120)}px`
            }}
          >
            <div className="flex flex-col text-sm dark:text-[#999] text-black">
              <small>ctrl + del = delete</small>
              <small>ctrl + back = delete</small>
              <small>ctrl + e = export</small>
            </div>
          </div>
        }
      </>
    )
  }
}

function ExpandIcon({ cb }: {
  cb: Kiru.MouseEventHandler<HTMLButtonElement>
}) {
  return () => {
    const isDarkTheme = useThemeDetector()

    return (
      <button
        type="button"
        aria-label="Resize note"
        onmousedown={cb}
        className="cursor-[se-resize] absolute right-0 bottom-0 rotate-[225deg] flex"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDarkTheme ? "#777" : "#999"}
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M2 10v4" />
          <path d="M4 8v8" />
          <path d="M6 5v14" />
        </svg>
      </button>
    )
  }
}
