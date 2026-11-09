import { effect, onCleanup, onMount, ref, setup, signal } from "kiru"
import { TextSignal, canvasDimentsion, focusedItem } from "../signals"
import { createDebounce } from "../utils/useDebounce"
import texts, { TextCardType } from "../signals/texts"
import { LayerEnum } from "../utils/enums"
import { Card, CardTypes } from "../types"
import { useThemeDetector } from "../utils/useThemeDetector"
import { ContextMenuPortal } from "./ContextMenuPortal"
import { mouse } from "../utils/mouse"
import { activeDragDisarmers, disarmActiveDrags } from "../utils/activeDrag"
import { moveFocusToToolbarAfterDelete } from "../utils/focusAfterDelete"
import { arrowKeyMovePosition, arrowKeyResizeFontSize } from "../utils/keyboardMove"
import { useToast } from "./Toast"
import { textCardName } from "../utils/cardName"
import {
  claimSaveFailureReport,
  clearSaveFailureReport,
} from "../utils/localStorage"

interface TextCardProps {
  itemKey: TextCardType['id']
  data: TextCardType
}

const _BLOCK_TAGS = new Set(["DIV", "P", "LI", "PRE", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "TR", "TD", "TH", "DT", "DD", "ADDRESS", "ARTICLE", "ASIDE", "CAPTION", "DETAILS", "DL", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "HEADER", "HGROUP", "HR", "MAIN", "NAV", "OL", "SECTION", "SUMMARY", "TABLE", "UL"])

function _firstContentIsBlock(el: HTMLElement): boolean | null {
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      if (child.textContent?.trim()) return false
      continue
    }
    if (child.nodeType !== 1) continue
    const childEl = child as HTMLElement
    if (childEl.tagName === "BR") return false
    if (_BLOCK_TAGS.has(childEl.tagName)) return true
    const nested = _firstContentIsBlock(childEl)
    if (nested !== null) return nested
  }
  return null
}

function _lastContentIsBlock(node: Node): boolean | null {
  if (node.nodeType === 3) return node.textContent?.trim() ? false : null
  if (node.nodeType !== 1) return null
  const el = node as HTMLElement
  if (el.tagName === "BR") return false
  if (_BLOCK_TAGS.has(el.tagName)) return true
  const children = Array.from(el.childNodes)
  for (let i = children.length - 1; i >= 0; i--) {
    const nested = _lastContentIsBlock(children[i])
    if (nested !== null) return nested
  }
  return null
}

function _joinChildText(childNodes: Node[], isFirst: boolean): string {
  let joined = ""
  let prevNode: Node | null = null
  let prevText = ""
  childNodes.forEach((child, i) => {
    let text = _plainTextFromNode(child, isFirst && i === 0)
    if (
      prevNode &&
      !prevText.endsWith("\n") &&
      text.trim() !== "" &&
      !text.startsWith("\n") &&
      _lastContentIsBlock(prevNode)
    )
      text = "\n" + text
    joined += text
    if (text.trim() !== "" || text.includes("\n")) {
      prevNode = child
      prevText = text
    }
  })
  return joined
}

function _plainTextFromNode(node: Node, isFirst = false): string {
  if (node.nodeType === 3) return node.textContent ?? ""
  if (node.nodeType !== 1) return ""
  const el = node as HTMLElement
  if (el.tagName === "BR") return "\n"
  const inner = _joinChildText(Array.from(el.childNodes), isFirst)
  if (_BLOCK_TAGS.has(el.tagName)) {
    const deduped =
      !isFirst && _firstContentIsBlock(el)
        ? inner.replace(/^\n/, "")
        : inner
    const stripped = deduped.replace(/\n$/, "")
    if (isFirst && stripped !== "") return stripped
    if (isFirst && inner === "") return ""
    return "\n" + stripped
  }
  return inner
}

export function TextItem(props: TextCardProps) {
  const $ = setup<TextCardProps>()
  const itemKey = props.itemKey
  const item = $.derive((p) => p.data)
  const { debounce } = createDebounce()
  const pressed = signal(false)
  const newX = ref(0)
  const newY = ref(0)
  const offsetX = ref(0)
  const offsetY = ref(0)
  const initialResizeX = ref(0)
  const initialFontSize = ref(0)
  const initialResizeW = ref(0)
  const initialResizeH = ref(0)
  const elRef = ref<HTMLDivElement>(null)
  const pRef = ref<HTMLParagraphElement>(null)
  const openContextMenu = signal(false)

  let lastMeasuredFontSize: number | null = null

  function _measureAndStoreDimensions() {
    const elDems = elRef.current?.getBoundingClientRect()
    const elW = Math.min(elDems?.width ?? 100, canvasDimentsion.value.width)
    const elH = Math.min(elDems?.height ?? 100, canvasDimentsion.value.height)
    if (elW <= 0 || elH <= 0) return
    const newDems: Card<CardTypes.TEXTS>['dimensions'] = { w: elW, h: elH }
    const pos = item.value.position
    const clampedPos = {
      x: Math.min(Math.max(pos.x, 0), Math.max(0, canvasDimentsion.value.width - elW)),
      y: Math.min(Math.max(pos.y, 0), Math.max(0, canvasDimentsion.value.height - elH)),
    }
    if (clampedPos.x !== pos.x || clampedPos.y !== pos.y) {
      TextSignal.default.updateTextProperty(itemKey, 'position', clampedPos)
    }
    TextSignal.default.updateTextProperty(itemKey, 'dimensions', newDems)
  }

  onMount(() => {
    if (pRef.current) {
      pRef.current.textContent = item.value.contents
    }
    lastMeasuredFontSize = item.value.fontSize
    _measureAndStoreDimensions()
  })

  effect(() => {
    const fontSize = item.value.fontSize
    if (!elRef.current) return
    if (fontSize === lastMeasuredFontSize) return
    lastMeasuredFontSize = fontSize
    _measureAndStoreDimensions()
  })

  const toast = useToast()

  function updateLocalStorage(time?: number) {
    debounce(() => {
      try {
        localStorage.setItem(CardTypes.TEXTS, JSON.stringify(texts.texts.value))
      } catch {
        if (claimSaveFailureReport()) {
          toast.showToast("error", "Could not save your changes!")
        }
        return
      }
      clearSaveFailureReport()
    }, time)
  }

  function persistLocalStorage() {
    localStorage.setItem(CardTypes.TEXTS, JSON.stringify(texts.texts.value))
    clearSaveFailureReport()
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

    TextSignal.default.updateTextProperty(itemKey, 'position', newPos)
    updateLocalStorage()
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
    const candidate = Math.floor(
      initialFontSize.current + (e.pageX - initialResizeX.current)
    )
    const scaleCap = Math.min(
      initialResizeW.current > 0
        ? (canvasDimentsion.value.width - item.value.position.x) /
            initialResizeW.current
        : Infinity,
      initialResizeH.current > 0
        ? (canvasDimentsion.value.height - item.value.position.y) /
            initialResizeH.current
        : Infinity
    )
    const fontCap = Math.floor(initialFontSize.current * scaleCap)
    const newFontSize = Math.max(fontCap >= 10 ? 10 : Math.max(1, fontCap), Math.min(candidate, fontCap))

    TextSignal.default.updateTextProperty(itemKey, 'fontSize', newFontSize)
    updateLocalStorage()
  }

  function _handleFocus() {
    focusedItem.value = itemKey
  }

  function _handleResizeMouseDown(e: Kiru.MouseEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    disarmActiveDrags()
    e.stopPropagation()
    initialResizeX.current = e.pageX
    initialFontSize.current = item.value.fontSize
    initialResizeW.current = item.value.dimensions.w
    initialResizeH.current = item.value.dimensions.h
    pressed.value = true
    window.addEventListener('mousemove', _handleResizeMove)
    window.addEventListener('mouseup', _handleResizeMouseUp)
  }

  function _handleResizeMouseUp(e?: MouseEvent) {
    if (e && e.button !== 0 && e.buttons !== 0) return
    pressed.value = false
    window.removeEventListener('mousemove', _handleResizeMove)
    window.removeEventListener('mouseup', _handleResizeMouseUp)
    updateLocalStorage()
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

  activeDragDisarmers.add(_disarmDrag)
  window.addEventListener('blur', _disarmDrag)
  window.addEventListener('beforeunload', flushLocalStorage)
  window.addEventListener('pagehide', flushLocalStorage)

  onCleanup(() => {
    window.removeEventListener('mousemove', _handleMouseMove)
    window.removeEventListener('mouseup', _handleMouseUp)
    window.removeEventListener('mousemove', _handleResizeMove)
    window.removeEventListener('mouseup', _handleResizeMouseUp)
    window.removeEventListener('beforeunload', flushLocalStorage)
    window.removeEventListener('pagehide', flushLocalStorage)
    window.removeEventListener('blur', _disarmDrag)
    activeDragDisarmers.delete(_disarmDrag)
    flushLocalStorage()
  })

  function _handleClose(e: Kiru.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    const ownMenu = openContextMenu.value
      ? (document.querySelector("#context-menu-portal > div") as HTMLElement | null)
      : null
    moveFocusToToolbarAfterDelete(elRef.current, (e.currentTarget as HTMLElement | null) ?? null, ownMenu)
    TextSignal.default.removeText(item.value.id)
    try {
      persistLocalStorage()
    } catch {
      if (claimSaveFailureReport()) {
        toast.showToast("error", "Could not save your changes!")
      }
    }
  }

  function _handleMouseClick(e: Kiru.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    mouse.value = { x: e.clientX, y: e.clientY }
    openContextMenu.value = !openContextMenu.value
  }

  function _handleContextClose() {
    openContextMenu.value = false
  }

  function _handleContentInput(e: InputEvent) {
    const el = e.target as HTMLParagraphElement & Pick<HTMLInputElement, 'oninput'>
    const val = _joinChildText(Array.from(el.childNodes), true)
    texts.updateTextProperty(itemKey, 'contents', val)
    _measureAndStoreDimensions()
    updateLocalStorage()
  }

  function _handleMoveKeyDown(e: KeyboardEvent) {
    if (pressed.value) return
    const newPos = arrowKeyMovePosition(e, item.value.position, item.value.dimensions, canvasDimentsion.value)
    if (!newPos) return
    e.preventDefault()
    TextSignal.default.updateTextProperty(itemKey, 'position', newPos)
    updateLocalStorage()
  }

  function _handleResizeKeyDown(e: KeyboardEvent) {
    if (pressed.value) return
    const newFontSize = arrowKeyResizeFontSize(e, item.value.fontSize, item.value.dimensions, item.value.position, canvasDimentsion.value)
    if (newFontSize === null) return
    e.preventDefault()
    TextSignal.default.updateTextProperty(itemKey, 'fontSize', newFontSize)
    updateLocalStorage()
  }

  effect(() => {
    if (focusedItem.value !== itemKey) return
    window.addEventListener('keydown', _handleMoveKeyDown)
    window.addEventListener('keydown', _handleResizeKeyDown)
    return () => {
      window.removeEventListener('keydown', _handleMoveKeyDown)
      window.removeEventListener('keydown', _handleResizeKeyDown)
    }
  })

  effect(() => {
    if (focusedItem.value !== itemKey) return

    function _handleClick(e: MouseEvent) {
      if (focusedItem.value !== itemKey) return
      const target = e.target as HTMLElement

      if (target === elRef.current) return
      if (elRef.current?.contains(target)) return

      const classes = '.text-container, .text-p, .text-pre, .text-close'
      if (target.closest(classes)) return
      if (target.matches(classes)) return

      focusedItem.value = null
      document.removeEventListener('mousedown', _handleClick)
    }

    function _handleFocusIn(e: FocusEvent) {
      if (focusedItem.value !== itemKey) return
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target === elRef.current) return
      if (elRef.current?.contains(target)) return
      if (target.closest?.('#context-menu-portal')) return

      focusedItem.value = null
    }

    document.addEventListener('mousedown', _handleClick)
    document.addEventListener('focusin', _handleFocusIn)
    return () => {
      document.removeEventListener('mousedown', _handleClick)
      document.removeEventListener('focusin', _handleFocusIn)
    }
  })

  return () => {
    const it = item.value

    const outline = `${focusedItem.value === it.id ? '1px solid' : ''}`
    const fontSize = `${it.fontSize / 6}px`
    const zIndex = `${focusedItem.value == itemKey ? LayerEnum.CARD_ELEVATED : LayerEnum.CARD}`
    const cardName = textCardName(it.contents)
    const nameSuffix = cardName ? `: ${cardName}` : ""
    const menuTitle = cardName || it.title

    return (
      <>
      <div
        ref={elRef}
        onmousedown={_handleMouseDown}
        oncontextmenu={_handleMouseClick}
        className="text-container dark:text-white transition flex flex-col justify-stretch rounded absolute touch-none"
        style={{
          outline: outline,
          fontSize: fontSize,
          zIndex: zIndex,
          top: `${it.position.y}px`,
          left: `${it.position.x}px`,
          userSelect: focusedItem.value === itemKey ? 'text' : 'none',
        }}
      >
        <pre
          className={'text-pre px-2 w-full select-none drop-shadow relative'}
        >
          <p
            ref={pRef}
            //@ts-expect-error oninput doesnt exist on the props type
            oninput={_handleContentInput}
            onfocus={_handleFocus}
            contentEditable
            role="textbox"
            aria-label={cardName ? `Text editor: ${cardName}` : "Text editor"}
            aria-multiline="true"
            className={'text-p inline-block px-2 w-full select-none drop-shadow relative'}>
          </p>
        </pre>

        <CloseIcon cb={_handleClose} itemId={it.id} label={`Delete text${nameSuffix}`} />
        <ExpandIcon cb={_handleResizeMouseDown} itemId={it.id} label={`Resize text${nameSuffix}`} />
      </div >

        <ContextMenuPortal open={openContextMenu} closeAction={_handleContextClose}>
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
                  <button type="button" role="menuitem" aria-label={`Delete text${nameSuffix}`} onclick={_handleClose} className="w-full text-left px-2 py-1 text-md text-[#999] group-hover:text-black dark:group-hover:text-[#999]">
                    Delete
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </ContextMenuPortal>
      </>
    )
  }
}

interface CloseIconProps {
  cb: Kiru.MouseEventHandler<HTMLButtonElement>,
  itemId: TextCardType['id'],
  label: string
}

function CloseIcon({ cb, itemId, label }: CloseIconProps) {
  return () => {
    const isDark = useThemeDetector()
    return (
      <button
        type="button"
        aria-label={label}
        onclick={cb}
        className="text-close cursor-pointer w-4 h-4 absolute top-[-8px] right-[-8px]"
        style={{
          display: focusedItem.value === itemId ? 'unset' : 'none'
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill={isDark ? 'black' : 'white'}
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          className="w-4 h-4 block"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </svg>
      </button>
    )
  }
}

interface ExpandIconProps {
  cb: Kiru.MouseEventHandler<HTMLButtonElement>,
  itemId: TextCardType['id'],
  label: string
}

function ExpandIcon({ cb, itemId, label }: ExpandIconProps) {
  return () => {
    const isDark = useThemeDetector()
    return (
      <button
        type="button"
        aria-label={label}
        onmousedown={cb}
        className="h-4 w-4 absolute right-[-6px] bottom-[-6px] cursor-se-resize touch-none"
        style={{
          display: focusedItem.value === itemId ? 'unset' : 'none'
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill={isDark ? 'black' : 'white'}
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          className="h-4 w-4 block"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
        </svg>
      </button>
    )
  }
}
