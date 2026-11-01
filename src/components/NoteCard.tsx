import { useSignal, useCallback, useEffect, useRef } from "kaioken"
import { NotesSigal, focusedItem } from "../signals"
import { useDebounce } from "../utils/useDebounce"
import notes, { NoteCardType } from "../signals/notes"
import { LayerEnum } from "../utils/enums"
import { useThemeDetector } from "../utils/useThemeDetector"
import { MarkDownEditor, type MarkDownEditorChange } from "./MarkDownEditor/MarkDownEditor"

import { Divider } from "./Divider"
import { ExportIcon } from "./icons/ExportIcon"
import { createFileAndExport } from "../utils/createFileAndExport"
import { ContextMenuPortal } from "./ContextMenuPortal"
import { HelpIcon } from "./icons/HelpIcon"

interface NoteCardProps {
  key: NoteCardType['id']
  data: NoteCardType
}

export function NoteCard({ key: itemKey, data: item }: NoteCardProps) {
  const saved = useSignal(true)
  const pressed = useSignal(false)
  const newX = useRef(0)
  const newY = useRef(0)
  const offsetX = useRef(0)
  const offsetY = useRef(0)
  const initialResizeX = useRef(0)
  const initialResizeY = useRef(0)
  const openContextMenu = useSignal(false)
  const showHelp = useSignal(false)

  const { debounce } = useDebounce()

  function updateLocalStorage(time?: number) {
    debounce(() => {
      localStorage.setItem("notes", JSON.stringify(notes.notes.value))
      saved.value = true
    }, time)
  }

  function _handleMouseMove(e: MouseEvent) {
    e.preventDefault()
    if (!pressed.value) return

    newX.current = e.pageX - offsetX.current
    newY.current = e.pageY - offsetY.current
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

  function _handleMouseDown(e: MouseEvent) {
    e.preventDefault()
    offsetX.current = e.offsetX
    offsetY.current = e.offsetY
    pressed.value = true
    window.addEventListener('mousemove', _handleMouseMove)
    window.addEventListener('mouseup', _handleMouseUp)
  }

  function _handleResizeMove(e: MouseEvent) {
    const { pageX, pageY } = e
    const [newX, newY] = [initialResizeX.current - pageX, initialResizeY.current - pageY]

    const newW = -newX + item.dimensions.w
    const newH = -newY + item.dimensions.h
    const newDim = { w: newW, h: newH }

    NotesSigal.default.updateNoteProperty(itemKey, 'dimensions', newDim)
    NotesSigal.default.notes.notify()
  }


  function _handleResizeMouseDown(e: MouseEvent) {
    initialResizeX.current = e.pageX
    initialResizeY.current = e.pageY
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

  function _handleMdChange(e: MarkDownEditorChange) {
    NotesSigal.default.updateNoteProperty(itemKey, 'contents', e.content)
    NotesSigal.default.notes.notify()
    updateLocalStorage()
    saved.value = false
  }

  function _handleClose() {
    NotesSigal.default.removeNote(item.id)
    NotesSigal.default.notes.notify()
    updateLocalStorage()
  }

  function _handleFocusCard() {
    focusedItem.value = itemKey
  }

  function _exportFile() {
    createFileAndExport("Note", item.contents, "text/markdown")
  }

  function _handleExportClick() {
    _exportFile()
  }

  function _handleMouseClick(e: MouseEvent) {
    e.preventDefault()
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

  const _handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!e.ctrlKey) return

    // TODO: add support for other os
    // TODO: add modal popup 

    switch (e.key) {
      case 'Delete':
        e.preventDefault()
        _handleClose()
        break
      case 'Backspace':
        e.preventDefault()
        _handleClose()
        break
      case 'e':
        e.preventDefault()
        _exportFile()
        break
      default:
        break
    }
  }, [itemKey, item.position, NotesSigal.default])

  useEffect(() => {
    if (focusedItem.value !== itemKey) return
    window.addEventListener('keydown', _handleKeyDown)
    return () => {
      window.removeEventListener('keydown', _handleKeyDown)
    }

  }, [focusedItem.value, itemKey])

  const cardPositionStyle = {
    zIndex: `${focusedItem.value == itemKey ? LayerEnum.CARD_ELEVATED : LayerEnum.CARD}`,
    width: `${item.dimensions.w}px`,
    height: `${item.dimensions.h}px`,
    top: `${item.position.y}px`,
    left: `${item.position.x}px`,
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
        className="overflow-hidden text-[#333] dark:bg-[#1a1a1a] dark:border-[#1c1c1c] bg-[#efeff0] select-none transition flex flex-col justify-stretch shadow-md rounded border border-[#ddd] absolute"
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
              <div
                onclick={_handleExportClick}
                className="flex items-center">
                <ExportIcon
                  className="dark:text-[#5c5c5c] cursor-pointer w-4 h-4 text-[#9c9c9c] hover:text-blue-500 transition-color duration-300"
                />
              </div>

              <Divider />

              <button className="text-md dark:text-[#777] text-black" onclick={_handleClose}>x</button>

            </div>
          </div>

          <hr className="border dark:border-[#2c2c2c] border-[#ddd]" />

          {/* Content Body */}
          <MarkDownEditor initial={item.contents} onChange={_handleMdChange} />
          <ExpandIcon cb={_handleResizeMouseDown} />
        </div>

        <ContextMenuPortal open={openContextMenu} closeAction={_handleContextClose}>
          <div className="bg-[#3c3c3c] flex flex-col rounded">
            <div className="flex justify-between items-center">
              <div className="text-md dark:text-[#999] text-black px-2 py-1">
                {item.title}
              </div>
            </div>

            <hr className="border dark:border-[#2c2c2c] border-[#ddd] m-0 p-0" />

            <div>
              <ul>
                <li className="flex items-center gap-2 hover:bg-[#fff] dark:hover:bg-[#1a1a1a] cursor-pointer px-2 py-1">
                  <button onclick={_handleClose} className="text-md dark:text-[#999]  text-black">
                    Delete
                  </button>
                </li>
                <li className="flex items-center gap-2 hover:bg-[#fff] dark:hover:bg-[#1a1a1a] cursor-pointer px-2 py-1">
                  <button onclick={_handleExportClick} className="text-md dark:text-[#999]  text-black">
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
            top: `${item.position.y}px`,
            left: `${item.position.x - 120}px`
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

function ExpandIcon({ cb }: {
  cb: (this: GlobalEventHandlers, ev: MouseEvent) => void
}) {
  const isDarkTheme = useThemeDetector()

  return (
    <svg
      onmousedown={cb}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={isDarkTheme ? "#777" : "#999"}
      stroke-width="1"
      stroke-linecap="round"
      stroke-linejoin="round"
      className="cursor-[se-resize] absolute right-0 bottom-0 rotate-[225deg]"
    >
      <path d="M2 10v4" />
      <path d="M4 8v8" />
      <path d="M6 5v14" />
    </svg>
  )
}


