import { useSignal, useEffect, useLayoutEffect, useRef } from "kaioken"
import { TextSignal, focusedItem } from "../signals"
import { useDebounce } from "../utils/useDebounce"
import texts, { TextCardType } from "../signals/texts"
import { LayerEnum } from "../utils/enums"
import { Card, CardTypes } from "../types"
import { useThemeDetector } from "../utils/useThemeDetector"

interface TextCardProps {
  key: TextCardType['id']
  data: TextCardType
}

export function TextItem({ key: itemKey, data: item }: TextCardProps) {
  const { debounce } = useDebounce()
  const pressed = useSignal(false)
  const newX = useRef(0)
  const newY = useRef(0)
  const offsetX = useRef(0)
  const offsetY = useRef(0)
  const initialResizeX = useRef(0)
  const elRef = useRef<HTMLDivElement>(null)
  const pRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const elDems = elRef.current?.getBoundingClientRect()
    const elW = elDems?.width ?? 100
    const elH = elDems?.height ?? 100
    const newDems: Card<CardTypes.TEXTS>['dimensions'] = { w: elW, h: elH }
    TextSignal.default.updateTextProperty(itemKey, 'dimensions', newDems)
    TextSignal.default.texts.notify()
  }, [elRef.current, item.fontSize])



  function updateLocalStorage(time?: number) {
    debounce(() => {
      localStorage.setItem(CardTypes.TEXTS, JSON.stringify(texts.texts.value))
    }, time)
  }

  function _handleMouseMove(e: MouseEvent) {
    e.preventDefault()
    if (!pressed.value) return

    newX.current = e.pageX - offsetX.current
    newY.current = e.pageY - offsetY.current
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

  function _handleMouseDown(e: MouseEvent) {
    focusedItem.value = itemKey
    offsetX.current = e.offsetX
    offsetY.current = e.offsetY
    pressed.value = true
    window.addEventListener('mousemove', _handleMouseMove)
    window.addEventListener('mouseup', _handleMouseUp)
  }

  function _handleResizeMove(e: MouseEvent) {
    const { pageX } = e
    const newX = initialResizeX.current - pageX
    const newFontSize = Math.floor(-newX + item.fontSize)

    TextSignal.default.updateTextProperty(itemKey, 'fontSize', newFontSize)
    TextSignal.default.texts.notify()
    updateLocalStorage()
  }

  function _handleResizeMouseDown(e: MouseEvent) {
    e.stopPropagation()
    initialResizeX.current = e.pageX
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

  function _handleClose(e: MouseEvent) {
    e.stopPropagation()
    TextSignal.default.removeText(item.id)
    TextSignal.default.texts.notify()
  }

  function _handleContentInput(e: InputEvent) {
    const el = e.target as HTMLParagraphElement & Pick<HTMLInputElement, 'oninput'>
    const val = el.innerHTML.split('<br>').join('\n')
    texts.updateTextProperty(itemKey, 'contents', val)
    updateLocalStorage()
  }

  useLayoutEffect(() => {
    if (!pRef.current) return
    pRef.current.textContent = item.contents
  }, [])

  useEffect(() => {
    function _handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement

      if (target === elRef.current) return
      if (elRef.current?.contains(target)) return

      const classes = '.text-container, .text-p, .text-pre, .text-close'
      if (target.closest(classes)) return
      if (target.matches(classes)) return

      focusedItem.value = null
      document.removeEventListener('mousedown', _handleClick)
    }

    if (focusedItem.value !== itemKey) return
    document.addEventListener('mousedown', _handleClick)
    return () => {
      document.removeEventListener('mousedown', _handleClick)
    }
  }, [focusedItem.value])

  const outline = `${focusedItem.value === item.id ? '1px solid' : ''}`
  const fontSize = `${item.fontSize / 6}px`
  const zIndex = `${focusedItem.value == itemKey ? LayerEnum.CARD_ELEVATED : LayerEnum.CARD}`

  return (
    <div
      ref={elRef}
      onmousedown={_handleMouseDown}
      className="text-container transition flex flex-col justify-stretch rounded absolute"
      style={{
        outline: outline,
        fontSize: fontSize,
        zIndex: zIndex,
        top: `${item.position.y}px`,
        left: `${item.position.x}px`,
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
          contentEditable
          className={'text-p inline-block px-2 w-full select-none drop-shadow relative'}>
        </p>
      </pre>

      <CloseIcon cb={_handleClose} item={item} />
      <ExpandIcon cb={_handleResizeMouseDown} item={item} />
    </div >

  )
}

interface CloseIconProps {
  cb: (this: GlobalEventHandlers, ev: MouseEvent) => void,
  item: TextSignal.TextCardType
}

function CloseIcon({ item, cb }: CloseIconProps) {
  const isDark = useThemeDetector()
  return (
    <svg
      onclick={cb}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={isDark ? 'black' : 'white'}
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      className="text-close cursor-pointer w-4 h-4 absolute top-[-8px] right-[-8px]"
      style={{
        display: focusedItem.value === item.id ? 'unset' : 'none'
      }}

    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  )
}

interface ExpandIconProps {
  cb: (this: GlobalEventHandlers, ev: MouseEvent) => void,
  item: TextSignal.TextCardType
}

function ExpandIcon({ cb, item }: ExpandIconProps) {
  const isDark = useThemeDetector()
  return (
    <svg
      onmousedown={cb}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={isDark ? 'black' : 'white'}
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      className="h-4 w-4 absolute right-[-6px] bottom-[-6px] cursor-se-resize"
      style={{
        display: focusedItem.value === item.id ? 'unset' : 'none'
      }}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
    </svg>
  )
}
