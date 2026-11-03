import { effect, onCleanup, onMount, ref, setup, signal } from "kiru"
import { TextSignal, focusedItem } from "../signals"
import { createDebounce } from "../utils/useDebounce"
import texts, { TextCardType } from "../signals/texts"
import { LayerEnum } from "../utils/enums"
import { Card, CardTypes } from "../types"
import { useThemeDetector } from "../utils/useThemeDetector"

interface TextCardProps {
  itemKey: TextCardType['id']
  data: TextCardType
}

const _BLOCK_TAGS = new Set(["DIV", "P", "LI", "PRE"])

function _plainTextFromNode(node: Node, isFirst = false): string {
  if (node.nodeType === 3) return node.textContent ?? ""
  if (node.nodeType !== 1) return ""
  const el = node as HTMLElement
  if (el.tagName === "BR") return "\n"
  const inner = Array.from(el.childNodes)
    .map((child, i) => _plainTextFromNode(child, isFirst && i === 0))
    .join("")
  if (_BLOCK_TAGS.has(el.tagName)) {
    const stripped = inner.replace(/\n$/, "")
    if (isFirst && stripped !== "") return stripped
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
  const elRef = ref<HTMLDivElement>(null)
  const pRef = ref<HTMLParagraphElement>(null)

  let lastMeasuredFontSize: number | null = null

  function _measureAndStoreDimensions() {
    const elDems = elRef.current?.getBoundingClientRect()
    const elW = elDems?.width ?? 100
    const elH = elDems?.height ?? 100
    if (elW <= 0 || elH <= 0) return
    const newDems: Card<CardTypes.TEXTS>['dimensions'] = { w: elW, h: elH }
    TextSignal.default.updateTextProperty(itemKey, 'dimensions', newDems)
    TextSignal.default.texts.notify()
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

  function updateLocalStorage(time?: number) {
    debounce(() => {
      localStorage.setItem(CardTypes.TEXTS, JSON.stringify(texts.texts.value))
    }, time)
  }

  function persistLocalStorage() {
    localStorage.setItem(CardTypes.TEXTS, JSON.stringify(texts.texts.value))
  }

  function _handleMouseMove(e: MouseEvent) {
    e.preventDefault()
    if (!pressed.value) return

    newX.current = Math.max(0, e.pageX - offsetX.current)
    newY.current = Math.max(0, e.pageY - offsetY.current)
    const newPos = { x: newX.current, y: newY.current }

    TextSignal.default.updateTextProperty(itemKey, 'position', newPos)
    updateLocalStorage()
  }

  function _handleMouseUp(e: MouseEvent) {
    e.preventDefault()
    pressed.value = false
    window.removeEventListener('mousemove', _handleMouseMove)
    window.removeEventListener('mouseup', _handleMouseUp)
  }

  function _handleMouseDown(e: Kiru.MouseEvent<HTMLDivElement>) {
    focusedItem.value = itemKey
    if (e.button !== 0) return
    offsetX.current = e.offsetX
    offsetY.current = e.offsetY
    pressed.value = true
    window.addEventListener('mousemove', _handleMouseMove)
    window.addEventListener('mouseup', _handleMouseUp)
  }

  function _handleResizeMove(e: MouseEvent) {
    const newFontSize = Math.max(
      10,
      Math.floor(initialFontSize.current + (e.pageX - initialResizeX.current))
    )

    TextSignal.default.updateTextProperty(itemKey, 'fontSize', newFontSize)
    TextSignal.default.texts.notify()
    updateLocalStorage()
  }

  function _handleFocus() {
    focusedItem.value = itemKey
  }

  function _handleResizeMouseDown(e: Kiru.MouseEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    e.stopPropagation()
    initialResizeX.current = e.pageX
    initialFontSize.current = item.value.fontSize
    pressed.value = true
    window.addEventListener('mousemove', _handleResizeMove)
    window.addEventListener('mouseup', _handleResizeMouseUp)
  }

  function _handleResizeMouseUp() {
    pressed.value = false
    window.removeEventListener('mousemove', _handleResizeMove)
    window.removeEventListener('mouseup', _handleResizeMouseUp)
    updateLocalStorage()
  }

  onCleanup(() => {
    window.removeEventListener('mousemove', _handleMouseMove)
    window.removeEventListener('mouseup', _handleMouseUp)
    window.removeEventListener('mousemove', _handleResizeMove)
    window.removeEventListener('mouseup', _handleResizeMouseUp)
  })

  function _handleClose(e: Kiru.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    TextSignal.default.removeText(item.value.id)
    TextSignal.default.texts.notify()
    persistLocalStorage()
  }

  function _handleContentInput(e: InputEvent) {
    const el = e.target as HTMLParagraphElement & Pick<HTMLInputElement, 'oninput'>
    const val = Array.from(el.childNodes)
      .map((child, i) => _plainTextFromNode(child, i === 0))
      .join("")
    texts.updateTextProperty(itemKey, 'contents', val)
    _measureAndStoreDimensions()
    updateLocalStorage()
  }

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

    document.addEventListener('mousedown', _handleClick)
    return () => {
      document.removeEventListener('mousedown', _handleClick)
    }
  })

  return () => {
    const it = item.value

    const outline = `${focusedItem.value === it.id ? '1px solid' : ''}`
    const fontSize = `${it.fontSize / 6}px`
    const zIndex = `${focusedItem.value == itemKey ? LayerEnum.CARD_ELEVATED : LayerEnum.CARD}`

    return (
      <div
        ref={elRef}
        onmousedown={_handleMouseDown}
        className="text-container dark:text-white transition flex flex-col justify-stretch rounded absolute"
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
            className={'text-p inline-block px-2 w-full select-none drop-shadow relative'}>
          </p>
        </pre>

        <CloseIcon cb={_handleClose} itemId={it.id} />
        <ExpandIcon cb={_handleResizeMouseDown} itemId={it.id} />
      </div >

    )
  }
}

interface CloseIconProps {
  cb: Kiru.MouseEventHandler<HTMLButtonElement>,
  itemId: TextCardType['id']
}

function CloseIcon({ cb, itemId }: CloseIconProps) {
  return () => {
    const isDark = useThemeDetector()
    return (
      <button
        type="button"
        aria-label="Delete text"
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
  itemId: TextCardType['id']
}

function ExpandIcon({ cb, itemId }: ExpandIconProps) {
  return () => {
    const isDark = useThemeDetector()
    return (
      <button
        type="button"
        aria-label="Resize text"
        onmousedown={cb}
        className="h-4 w-4 absolute right-[-6px] bottom-[-6px] cursor-se-resize"
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
