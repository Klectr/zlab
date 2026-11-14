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
import { createImageCardFromFile } from "../utils/createImageCard"
import { findMinimapMarker, moveFocusToToolbarAfterDelete } from "../utils/focusAfterDelete"
import { consumeEditorFocus } from "../utils/editorFocus"
import { arrowKeyMovePosition, arrowKeyResizeDimensions, scrollCardIntoView } from "../utils/keyboardMove"
import { ContextMenuPortal, isAnyContextMenuOpen, requestMenuItemFocus } from "./ContextMenuPortal"
import { mouse } from "../utils/mouse"
import { activeDragDisarmers, disarmActiveDrags } from "../utils/activeDrag"
import { HelpIcon } from "./icons/HelpIcon"
import { MenuIcon } from "./icons/MenuIcon"
import { cardSnippet, noteCardName } from "../utils/cardName"
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
  const dragStartPos = ref<{ x: number; y: number } | null>(null)
  const dragKind = ref<string | null>(null)
  const openContextMenu = signal(false)
  const menuId = `note-menu-${itemKey}`
  const showHelp = signal(false)
  const helpPinned = signal(false)
  const autoFocusEditor = consumeEditorFocus(itemKey)
  const cardRef = ref<HTMLDivElement>(null)

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
    if ((e.buttons & 1) === 0) {
      _handleMouseUp()
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

  function _handleMouseUp(e?: MouseEvent) {
    if (e && e.button !== 0 && e.buttons !== 0) return
    e?.preventDefault()
    pressed.value = false
    dragKind.current = null
    window.removeEventListener('mousemove', _handleMouseMove)
    window.removeEventListener('mouseup', _handleMouseUp)
  }

  function _handleMouseDown(e: Kiru.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const target = e.target as HTMLElement | null
    if (target && typeof target.closest === "function" && target.closest("button")) return
    disarmActiveDrags()
    e.preventDefault()
    offsetX.current = e.pageX - item.value.position.x
    offsetY.current = e.pageY - item.value.position.y
    dragStartPos.current = { x: item.value.position.x, y: item.value.position.y }
    dragKind.current = "move"
    pressed.value = true
    window.addEventListener('mousemove', _handleMouseMove)
    window.addEventListener('mouseup', _handleMouseUp)
  }

  function _handleResizeMove(e: MouseEvent) {
    if ((e.buttons & 1) === 0) {
      _handleResizeMouseUp()
      return
    }
    const newW = Math.max(Math.min(100, canvasDimentsion.value.width - item.value.position.x), Math.min(initialResizeW.current + (e.pageX - initialResizeX.current), canvasDimentsion.value.width - item.value.position.x))
    const newH = Math.max(Math.min(80, canvasDimentsion.value.height - item.value.position.y), Math.min(initialResizeH.current + (e.pageY - initialResizeY.current), canvasDimentsion.value.height - item.value.position.y))
    const newDim = { w: newW, h: newH }

    NotesSigal.default.updateNoteProperty(itemKey, 'dimensions', newDim)
  }


  function _handleResizeMouseDown(e: Kiru.MouseEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    disarmActiveDrags()
    initialResizeX.current = e.pageX
    initialResizeY.current = e.pageY
    initialResizeW.current = item.value.dimensions.w
    initialResizeH.current = item.value.dimensions.h
    dragKind.current = "resize"
    pressed.value = true
    window.addEventListener('mousemove', _handleResizeMove)
    window.addEventListener('mouseup', _handleResizeMouseUp)
  }

  function _handleResizeMouseUp(e?: MouseEvent) {
    if (e && e.button !== 0 && e.buttons !== 0) return
    pressed.value = false
    dragKind.current = null
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

  function _cancelDrag() {
    if (!pressed.value) return
    if (dragKind.current === "move" && dragStartPos.current) {
      NotesSigal.default.updateNoteProperty(itemKey, 'position', { x: dragStartPos.current.x, y: dragStartPos.current.y })
    } else if (dragKind.current === "resize") {
      NotesSigal.default.updateNoteProperty(itemKey, 'dimensions', { w: initialResizeW.current, h: initialResizeH.current })
    }
    _handleMouseUp()
    _handleResizeMouseUp()
  }

  function _handleDragEscape(e: KeyboardEvent) {
    if (e.key !== "Escape" || !pressed.value) return
    e.preventDefault()
    e.stopPropagation()
    _cancelDrag()
  }

  function _disarmDrag() {
    if (!pressed.value) return
    _handleMouseUp()
    _handleResizeMouseUp()
  }

  function _handleFocusIn(e: FocusEvent) {
    const el = cardRef.current
    if (!el) return
    const target = e.target as HTMLElement | null
    if (target && el.contains(target)) {
      _handleFocusCard()
      return
    }
    if (focusedItem.value !== itemKey) return
    if (target?.closest?.("#context-menu-portal")) return
    focusedItem.value = null
  }

  activeDragDisarmers.add(_disarmDrag)
  window.addEventListener('blur', _disarmDrag)
  window.addEventListener('keydown', _handleDragEscape, true)
  window.addEventListener('beforeunload', flushLocalStorage)
  window.addEventListener('pagehide', flushLocalStorage)
  document.addEventListener('focusin', _handleFocusIn)

  onCleanup(() => {
    window.removeEventListener('mousemove', _handleMouseMove)
    window.removeEventListener('mouseup', _handleMouseUp)
    window.removeEventListener('mousemove', _handleResizeMove)
    window.removeEventListener('mouseup', _handleResizeMouseUp)
    window.removeEventListener('beforeunload', flushLocalStorage)
    window.removeEventListener('pagehide', flushLocalStorage)
    document.removeEventListener('focusin', _handleFocusIn)
    window.removeEventListener('blur', _disarmDrag)
    window.removeEventListener('keydown', _handleDragEscape, true)
    activeDragDisarmers.delete(_disarmDrag)
    flushLocalStorage()
  })

  function _handleMdChange(e: MarkDownEditorChange) {
    NotesSigal.default.updateNoteProperty(itemKey, 'contents', e.content)
    updateLocalStorage()
    saved.value = false
  }

  function _handleClose(e?: Kiru.MouseEvent<HTMLButtonElement>) {
    const ownMenu = openContextMenu.value
      ? (document.querySelector("#context-menu-portal > div") as HTMLElement | null)
      : null
    const ownMarker = findMinimapMarker(itemKey)
    moveFocusToToolbarAfterDelete(cardRef.current, (e?.currentTarget as HTMLElement | null) ?? null, ownMenu, ownMarker)
    NotesSigal.default.removeNote(item.value.id)
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

  function _handlePasteImage(files: File[]) {
    files.forEach((file, i) => {
      createImageCardFromFile(file, {
        x: item.value.position.x + i * 24,
        y: item.value.position.y + i * 24
      }, () => toast.showToast("error", "Could not add such a girthy image!"), () => toast.showToast("error", "Could not load that image!"), () => {
        if (cardRef.current?.contains(document.activeElement)) {
          focusedItem.value = itemKey
        }
      })
    })
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
    const rect = e.currentTarget.getBoundingClientRect()
    mouse.value = {
      x: e.clientX !== 0 ? e.clientX : rect.left,
      y: e.clientY !== 0 ? e.clientY : rect.top,
    }
    openContextMenu.value = !openContextMenu.value
  }

  function _handleContextClose() {
    openContextMenu.value = false
  }

  function _handleMenuButtonClick(e: Kiru.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    mouse.value = {
      x: e.clientX !== 0 ? e.clientX : rect.left,
      y: e.clientY !== 0 ? e.clientY : rect.bottom,
    }
    openContextMenu.value = !openContextMenu.value
  }

  function _handleMenuButtonKeyDown(e: Kiru.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (openContextMenu.value) return
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    mouse.value = { x: rect.left, y: rect.bottom }
    requestMenuItemFocus(menuId, e.key === "ArrowDown" ? "first" : "last")
    openContextMenu.value = true
  }

  function _handleHelpHover() {
    if (showHelp.value) return
    showHelp.value = true
  }

  function _handleHelpOut() {
    if (!showHelp.value || helpPinned.value) return
    showHelp.value = false
  }

  function _handleHelpClick() {
    helpPinned.value = !helpPinned.value
    showHelp.value = helpPinned.value
  }

  effect(() => {
    if (!showHelp.value) return
    let searchPanelOpen = false
    function _noteSearchPanelEscape(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      const target = e.target as Element | null
      const editor = target?.closest?.(".cm-editor")
      searchPanelOpen = !!target?.closest?.(".cm-panel.cm-search") || !!target?.closest?.(".cm-goto-line") || !!(editor && (editor.querySelector(".cm-panel.cm-search") || editor.querySelector(".cm-goto-line")))
    }
    function _handleHelpEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && !searchPanelOpen && !isAnyContextMenuOpen()) {
        helpPinned.value = false
        showHelp.value = false
      }
    }
    document.addEventListener("keydown", _noteSearchPanelEscape, true)
    document.addEventListener("keydown", _handleHelpEscape)
    return () => {
      document.removeEventListener("keydown", _noteSearchPanelEscape, true)
      document.removeEventListener("keydown", _handleHelpEscape)
    }
  })

  function _handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault()
      flushLocalStorage()
      return
    }
    if (e.repeat) return
    if ((!e.ctrlKey && !e.metaKey) || e.altKey) return

    const target = e.target as HTMLElement | null
    const inEditableTarget = !!target && typeof target.closest === "function" && !!target.closest("input, textarea, select, [contenteditable], .cm-editor, #context-menu-portal")
    const inTextTarget = !!target && typeof target.closest === "function" && !!target.closest("input, textarea, select, [contenteditable], .cm-editor")

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
        if (inTextTarget) return
        e.preventDefault()
        _exportFile()
        if (openContextMenu.value) _handleContextClose()
        break
      default:
        break
    }
  }

  function _handleMoveKeyDown(e: KeyboardEvent) {
    if (pressed.value) return
    const newPos = arrowKeyMovePosition(e, item.value.position, item.value.dimensions, canvasDimentsion.value)
    if (!newPos) return
    e.preventDefault()
    NotesSigal.default.updateNoteProperty(itemKey, 'position', newPos)
    updateLocalStorage()
    scrollCardIntoView(newPos, item.value.dimensions)
  }

  function _handleResizeKeyDown(e: KeyboardEvent) {
    if (pressed.value) return
    const newDim = arrowKeyResizeDimensions(e, item.value.dimensions, item.value.position, canvasDimentsion.value)
    if (!newDim) return
    e.preventDefault()
    NotesSigal.default.updateNoteProperty(itemKey, 'dimensions', newDim)
    updateLocalStorage()
    scrollCardIntoView(item.value.position, newDim)
  }

  effect(() => {
    if (focusedItem.value !== itemKey) return
    window.addEventListener('keydown', _handleKeyDown)
    window.addEventListener('keydown', _handleMoveKeyDown)
    window.addEventListener('keydown', _handleResizeKeyDown)
    return () => {
      window.removeEventListener('keydown', _handleKeyDown)
      window.removeEventListener('keydown', _handleMoveKeyDown)
      window.removeEventListener('keydown', _handleResizeKeyDown)
    }
  })

  return () => {
    const it = item.value
    const cardName = noteCardName(it.title, it.contents)
    const nameSuffix = cardName ? `: ${cardName}` : ""
    const menuTitle = cardSnippet(cardName) || cardName

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
          ref={cardRef}
          oncontextmenu={_handleMouseClick}
          onmousedown={_handleFocusCard}
          style={cardPositionStyle}
          className="overflow-hidden text-[#333] dark:text-white dark:bg-[#1a1a1a] dark:border-[#5c5c5c] bg-[#efeff0] select-none transition flex flex-col justify-stretch shadow-md rounded border border-[#ddd] absolute"
        >
          <div className="overflow-hidden flex-1 flex flex-col gap-1">
            {/* Header Bar */}
            <div className="px-2 flex justify-between items-center cursor-move touch-none" onmousedown={_handleMouseDown}>
              <div className={"flex gap-1 items-center"}>
                <HelpIcon onMouseOver={_handleHelpHover} onMouseOut={_handleHelpOut} onClick={_handleHelpClick} describedBy={`note-shortcuts-${itemKey}`} expanded={showHelp.value} label={`Show note shortcuts${nameSuffix}`} />
                {/* Save indicator*/}
                <div style={saveIndicatorStyle} className="rounded-full w-1 h-1 dark:bg-white bg-green-500"></div>
                <span role="status" className="sr-only">{saved.value ? "" : "Unsaved changes"}</span>
              </div>
              <div className="flex gap-2">
                <MenuIcon label={`Note menu${nameSuffix}`} controls={menuId} expanded={openContextMenu.value} onClick={_handleMenuButtonClick} onKeyDown={_handleMenuButtonKeyDown} />
                <button type="button" aria-label={`Export note${nameSuffix}`} onclick={_handleExportClick} className="flex items-center">
                  <ExportIcon
                    className="cursor-pointer w-4 h-4 text-[#767676] dark:text-[#9c9c9c] hover:text-blue-500 transition-color duration-300"
                  />
                </button>

                <Divider />

                <button type="button" aria-label={`Delete note${nameSuffix}`} className="text-md dark:text-white text-black cursor-pointer" onclick={_handleClose}>x</button>

              </div>
            </div>

            <hr className="border dark:border-[#2c2c2c] border-[#ddd]" />

            {/* Content Body */}
            <MarkDownEditor initial={it.contents} title={cardName || undefined} autoFocus={autoFocusEditor} autoFocusCheck={() => focusedItem.value === itemKey} onChange={_handleMdChange} onFocus={_handleFocusCard} onPasteImage={_handlePasteImage} />
            <ExpandIcon cb={_handleResizeMouseDown} label={`Resize note${nameSuffix}`} />
          </div>

          <ContextMenuPortal open={openContextMenu} closeAction={_handleContextClose} label={`Note menu${nameSuffix}`} menuId={menuId}>
            <div className="bg-[#3c3c3c] flex flex-col rounded dark:border dark:border-[#5c5c5c]">
              <div className="flex justify-between items-center">
                <div className="text-md text-[#b3b3b3] px-2 py-1">
                  {menuTitle}
                </div>
              </div>

              <hr className="border border-[#ddd] m-0 p-0" />

              <div>
                <ul role="none">
                  <li role="none" className="group flex items-center hover:bg-[#fff] dark:hover:bg-[#1a1a1a] cursor-pointer">
                    <button type="button" role="menuitem" aria-label={`Delete note${nameSuffix}`} onclick={_handleClose} className="w-full text-left px-2 py-1 text-md text-[#b3b3b3] group-hover:text-black dark:group-hover:text-[#b3b3b3]">
                      Delete
                    </button>
                  </li>
                  <li role="none" className="group flex items-center hover:bg-[#fff] dark:hover:bg-[#1a1a1a] cursor-pointer">
                    <button type="button" role="menuitem" aria-label={`Export note${nameSuffix}`} onclick={_handleContextExportClick} className="w-full text-left px-2 py-1 text-md text-[#b3b3b3] group-hover:text-black dark:group-hover:text-[#b3b3b3]">
                      Export
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
            id={`note-shortcuts-${itemKey}`}
            className={"dark:text-white absolute dark:bg-[#1c1c1c] bg-[#fff] rounded-md p-1 z-[1000] border border-blue-500"}
            style={{
              top: `${it.position.y}px`,
              left: `${Math.max(0, it.position.x - 120)}px`
            }}
          >
            <div className="flex flex-col text-sm dark:text-[#999] text-black">
              <small>ctrl/cmd + del = delete</small>
              <small>ctrl/cmd + back = delete</small>
              <small>ctrl/cmd + s = save</small>
              <small>ctrl/cmd + e = export</small>
              <small>arrow keys = move card (shift = 50px)</small>
              <small>alt + arrow keys = resize card (shift = 50px)</small>
            </div>
          </div>
        }
      </>
    )
  }
}

function ExpandIcon({ cb, label }: {
  cb: Kiru.MouseEventHandler<HTMLButtonElement>
  label: string
}) {
  return () => {
    const isDarkTheme = useThemeDetector()

    return (
      <button
        type="button"
        aria-label={label}
        onmousedown={cb}
        className="cursor-[se-resize] absolute right-0 bottom-0 rotate-[225deg] flex touch-none"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDarkTheme ? "#777" : "#767676"}
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
