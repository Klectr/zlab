import { effect, onCleanup, ref, setup, signal } from "kiru"
import { ImagesSignal, canvasDimentsion, focusedItem } from "../signals"
import { createDebounce } from "../utils/useDebounce"
import { LayerEnum } from "../utils/enums"
import images, { ImageCardType } from "../signals/images"
import {
  claimSaveFailureReport,
  clearSaveFailureReport,
  updateLocalStorage,
} from "../utils/localStorage"
import { useToast } from "./Toast"
import { ContextMenuPortal, isAnyContextMenuOpen } from "./ContextMenuPortal"
import { mouse } from "../utils/mouse"
import { activeDragDisarmers, disarmActiveDrags } from "../utils/activeDrag"
import { findMinimapMarker, moveFocusToToolbarAfterDelete } from "../utils/focusAfterDelete"
import { arrowKeyMovePosition, arrowKeyResizeDimensions } from "../utils/keyboardMove"
import { CardTypes } from "../types"
import { cardSnippet, imageCardName } from "../utils/cardName"
import { MenuIcon } from "./icons/MenuIcon"
import { HelpIcon } from "./icons/HelpIcon"

interface ImageCardProps {
  itemKey: ImageCardType['id']
  data: ImageCardType
}

export function ImageCard(props: ImageCardProps) {
  const $ = setup<ImageCardProps>()
  const itemKey = props.itemKey
  const item = $.derive((p) => p.data)
  const { debounce } = createDebounce()
  const pressed = signal(false)
  const cardRef = ref<HTMLDivElement>(null)
  const newX = ref(0)
  const newY = ref(0)
  const offsetX = ref(0)
  const offsetY = ref(0)
  const initialResizeX = ref(0)
  const initialResizeY = ref(0)
  const initialResizeW = ref(0)
  const initialResizeH = ref(0)
  const openContextMenu = signal(false)
  const menuId = `image-menu-${itemKey}`
  const showHelp = signal(false)
  const helpPinned = signal(false)

  const toast = useToast()

  function debounceLSUpdate(time?: number) {
    debounce(() => {
      try {
        updateLocalStorage(CardTypes.IMAGES, images.images).notify()
      } catch {
        if (claimSaveFailureReport()) {
          toast.showToast("error", "Could not save your changes!")
        }
        return
      }
      clearSaveFailureReport()
    }, time)
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

    ImagesSignal.default.updateImageProperty(itemKey, 'position', newPos)
    debounceLSUpdate()
  }

  function _handleMouseUp(e?: MouseEvent) {
    if (e && e.button !== 0 && e.buttons !== 0) return
    e?.preventDefault()
    pressed.value = false
    window.removeEventListener('mousemove', _handleMouseMove)
    window.removeEventListener('mouseup', _handleMouseUp)
  }

  function _handleMouseDown(e: Kiru.MouseEvent<HTMLDivElement>) {
    focusedItem.value = itemKey
    if (e.button !== 0) return
    const target = e.target as HTMLElement | null
    if (target && typeof target.closest === "function" && target.closest("button")) return
    disarmActiveDrags()
    e.preventDefault()
    offsetX.current = e.pageX - item.value.position.x
    offsetY.current = e.pageY - item.value.position.y
    pressed.value = true
    window.addEventListener('mousemove', _handleMouseMove)
    window.addEventListener('mouseup', _handleMouseUp)
  }

  function _handleResizeMove(e: MouseEvent) {
    if ((e.buttons & 1) === 0) {
      _handleResizeMouseUp()
      return
    }
    const newDim = {
      w: Math.max(Math.min(100, canvasDimentsion.value.width - item.value.position.x), Math.min(initialResizeW.current + (e.pageX - initialResizeX.current), canvasDimentsion.value.width - item.value.position.x)),
      h: Math.max(Math.min(80, canvasDimentsion.value.height - item.value.position.y), Math.min(initialResizeH.current + (e.pageY - initialResizeY.current), canvasDimentsion.value.height - item.value.position.y)),
    }

    ImagesSignal.default.updateImageProperty(itemKey, 'dimensions', newDim)
  }


  function _handleResizeMouseDown(e: Kiru.MouseEvent<HTMLButtonElement>) {
    focusedItem.value = itemKey
    if (e.button !== 0) return
    disarmActiveDrags()
    e.stopPropagation()
    initialResizeX.current = e.pageX
    initialResizeY.current = e.pageY
    initialResizeW.current = item.value.dimensions.w
    initialResizeH.current = item.value.dimensions.h
    pressed.value = true
    window.addEventListener('mousemove', _handleResizeMove)
    window.addEventListener('mouseup', _handleResizeMouseUp)
  }

  function _handleResizeMouseUp(e?: MouseEvent) {
    if (e && e.button !== 0 && e.buttons !== 0) return
    pressed.value = false
    debounceLSUpdate()
    window.removeEventListener('mousemove', _handleResizeMove)
    window.removeEventListener('mouseup', _handleResizeMouseUp)
  }

  function persistLocalStorage() {
    updateLocalStorage(CardTypes.IMAGES, images.images)
  }

  function flushLocalStorage() {
    try {
      persistLocalStorage()
    } catch {
      return
    }
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
      focusedItem.value = itemKey
      return
    }
    if (focusedItem.value !== itemKey) return
    if (target?.closest?.("#context-menu-portal")) return
    focusedItem.value = null
  }

  activeDragDisarmers.add(_disarmDrag)
  window.addEventListener('blur', _disarmDrag)
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
    window.removeEventListener('blur', _disarmDrag)
    document.removeEventListener('focusin', _handleFocusIn)
    activeDragDisarmers.delete(_disarmDrag)
    flushLocalStorage()
  })

  function _handleClose(e?: Kiru.MouseEvent<HTMLButtonElement>) {
    const ownMenu = openContextMenu.value
      ? (document.querySelector("#context-menu-portal > div") as HTMLElement | null)
      : null
    const ownMarker = findMinimapMarker(itemKey)
    moveFocusToToolbarAfterDelete(cardRef.current, (e?.currentTarget as HTMLElement | null) ?? null, ownMenu, ownMarker)
    ImagesSignal.default.removeImage(item.value.id)
    try {
      updateLocalStorage(CardTypes.IMAGES, images.images).notify()
    } catch {
      if (claimSaveFailureReport()) {
        toast.showToast("error", "Could not save your changes!")
      }
    }
  }

  function _handleKeyDown(e: KeyboardEvent) {
    if (e.repeat) return
    if (!e.ctrlKey && !e.metaKey) return
    if (e.key !== 'Delete' && e.key !== 'Backspace') return
    const target = e.target as HTMLElement | null
    const inEditableTarget = !!target && typeof target.closest === "function" && !!target.closest("input, textarea, select, [contenteditable], .cm-editor, #context-menu-portal")
    if (inEditableTarget) return
    e.preventDefault()
    _handleClose()
  }

  function _handleMoveKeyDown(e: KeyboardEvent) {
    if (pressed.value) return
    const newPos = arrowKeyMovePosition(e, item.value.position, item.value.dimensions, canvasDimentsion.value)
    if (!newPos) return
    e.preventDefault()
    ImagesSignal.default.updateImageProperty(itemKey, 'position', newPos)
    debounceLSUpdate()
  }

  function _handleResizeKeyDown(e: KeyboardEvent) {
    if (pressed.value) return
    const newDim = arrowKeyResizeDimensions(e, item.value.dimensions, item.value.position, canvasDimentsion.value)
    if (!newDim) return
    e.preventDefault()
    ImagesSignal.default.updateImageProperty(itemKey, 'dimensions', newDim)
    debounceLSUpdate()
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
    if (!showHelp.value || helpPinned.value) return
    showHelp.value = false
  }

  function _handleHelpClick() {
    helpPinned.value = !helpPinned.value
    showHelp.value = helpPinned.value
  }

  effect(() => {
    if (!showHelp.value) return
    function _handleHelpEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && !isAnyContextMenuOpen()) {
        helpPinned.value = false
        showHelp.value = false
      }
    }
    document.addEventListener("keydown", _handleHelpEscape)
    return () => document.removeEventListener("keydown", _handleHelpEscape)
  })

  function _handleMenuButtonClick(e: Kiru.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    mouse.value = {
      x: e.clientX !== 0 ? e.clientX : rect.left,
      y: e.clientY !== 0 ? e.clientY : rect.bottom,
    }
    openContextMenu.value = !openContextMenu.value
  }

  return () => {
    const it = item.value
    const cardName = imageCardName(it.title)
    const nameSuffix = cardName ? `: ${cardName}` : ""
    const menuTitle = cardSnippet(cardName) || cardName

    return (
      <>
        <div
          ref={cardRef}
          oncontextmenu={_handleMouseClick}
          onmousedown={_handleMouseDown}
          className="select-none transition flex flex-col justify-stretch shadow-md rounded border border-[#1c1c1c] dark:border-[#5c5c5c] absolute touch-none"
          style={{
            zIndex: `${focusedItem.value == itemKey ? LayerEnum.CARD_ELEVATED : LayerEnum.CARD}`,
            top: `${it.position.y}px`,
            left: `${it.position.x}px`,
            width: `${it.dimensions.w}px`,
            height: `${it.dimensions.h}px`,
            backgroundColor: '#181818',
            backgroundImage: `url(${it.contents})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <span role="img" aria-label={cardName || "Image"} className="sr-only"></span>

          <MenuIcon label={`Image menu${nameSuffix}`} controls={menuId} expanded={openContextMenu.value} onClick={_handleMenuButtonClick} buttonClass="flex justify-center items-center bg-black/60 hover:bg-blue-500 rounded w-5 h-5 text-white absolute left-0 top-0 cursor-pointer" iconClass="w-4 h-4 text-white" />

          <HelpIcon onMouseOver={_handleHelpHover} onMouseOut={_handleHelpOut} onClick={_handleHelpClick} describedBy={`image-shortcuts-${itemKey}`} expanded={showHelp.value} label={`Show image shortcuts${nameSuffix}`} buttonClass="flex justify-center items-center bg-black/60 hover:bg-blue-500 rounded w-5 h-5 text-white absolute left-[24px] top-0 cursor-pointer" iconClass="w-4 h-4 text-white" />

          <button
            type="button"
            aria-label={`Delete image${nameSuffix}`}
            className="flex justify-center items-center bg-black/60 hover:bg-blue-500 rounded w-5 h-5 text-white text-md absolute right-0 top-0 cursor-pointer"
            onclick={_handleClose}>x</button>

          <ExpandIcon cb={_handleResizeMouseDown} label={`Resize image${nameSuffix}`} />
        </div >

        <ContextMenuPortal open={openContextMenu} closeAction={_handleContextClose} label={`Image menu${nameSuffix}`} menuId={menuId}>
          <div className="bg-[#3c3c3c] flex flex-col rounded">
            <div className="flex justify-between items-center">
              <div className="text-md text-[#999] px-2 py-1">
                {menuTitle}
              </div>
            </div>

            <hr className="border border-[#ddd] m-0 p-0" />

            <div>
              <ul role="none">
                <li role="none" className="group flex items-center hover:bg-[#fff] dark:hover:bg-[#1a1a1a] cursor-pointer">
                  <button type="button" role="menuitem" aria-label={`Delete image${nameSuffix}`} onclick={_handleClose} className="w-full text-left px-2 py-1 text-md text-[#999] group-hover:text-black dark:group-hover:text-[#999]">
                    Delete
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </ContextMenuPortal>

        {showHelp.value &&
          <div
            id={`image-shortcuts-${itemKey}`}
            className={"dark:text-white absolute dark:bg-[#1c1c1c] bg-[#fff] rounded-md p-1 z-[1000] border border-blue-500"}
            style={{
              top: `${it.position.y}px`,
              left: `${Math.max(0, it.position.x - 120)}px`
            }}
          >
            <div className="flex flex-col text-sm dark:text-[#999] text-black">
              <small>ctrl/cmd + del = delete</small>
              <small>ctrl/cmd + back = delete</small>
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
    return (
      <button
        type="button"
        aria-label={label}
        onmousedown={cb}
        className="cursor-[se-resize] absolute right-0 bottom-0 rotate-[225deg] flex touch-none bg-black/60 rounded-full"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
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
