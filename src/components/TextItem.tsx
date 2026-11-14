import { effect, onCleanup, onMount, ref, setup, signal } from "kiru"
import { TextSignal, canvasDimentsion, focusedItem } from "../signals"
import { createDebounce } from "../utils/useDebounce"
import texts, { TextCardType } from "../signals/texts"
import { LayerEnum } from "../utils/enums"
import { Card, CardTypes } from "../types"
import { useThemeDetector } from "../utils/useThemeDetector"
import { ContextMenuPortal, isAnyContextMenuOpen, requestMenuItemFocus } from "./ContextMenuPortal"
import { mouse } from "../utils/mouse"
import { activeDragDisarmers, disarmActiveDrags } from "../utils/activeDrag"
import { findMinimapMarker, moveFocusToToolbarAfterDelete } from "../utils/focusAfterDelete"
import { arrowKeyMovePosition, arrowKeyResizeFontSize, scrollCardIntoView } from "../utils/keyboardMove"
import { consumeEditorFocus } from "../utils/editorFocus"
import { useToast } from "./Toast"
import { cardSnippet, textCardName } from "../utils/cardName"
import { createImageCardFromFile, imageFilesFromHtml } from "../utils/createImageCard"
import { MenuIcon } from "./icons/MenuIcon"
import { HelpIcon } from "./icons/HelpIcon"
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
  const initialResizeY = ref(0)
  const initialFontSize = ref(0)
  const initialResizeW = ref(0)
  const initialResizeH = ref(0)
  const dragStartPos = ref<{ x: number; y: number } | null>(null)
  const dragKind = ref<string | null>(null)
  const elRef = ref<HTMLDivElement>(null)
  const pRef = ref<HTMLParagraphElement>(null)
  const openContextMenu = signal(false)
  const menuId = `text-menu-${itemKey}`
  const showHelp = signal(false)
  const helpPinned = signal(false)
  const autoFocusText = consumeEditorFocus(itemKey)

  let lastMeasuredFontSize: number | null = null
  let resizeObserver: ResizeObserver | null = null

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
    updateLocalStorage()
  }

  onMount(() => {
    if (pRef.current) {
      pRef.current.textContent = item.value.contents
      pRef.current.addEventListener('paste', _handlePaste)
      pRef.current.addEventListener('drop', _handleDrop)
      if (autoFocusText && focusedItem.value === itemKey) {
        pRef.current.focus()
      }
    }
    lastMeasuredFontSize = item.value.fontSize
    _measureAndStoreDimensions()
    if (elRef.current && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => _measureAndStoreDimensions())
      resizeObserver.observe(elRef.current)
    }
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

    TextSignal.default.updateTextProperty(itemKey, 'position', newPos)
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
    focusedItem.value = itemKey
    if (e.button !== 0) return
    const target = e.target as HTMLElement | null
    if (target && typeof target.closest === "function" && target.closest("button")) return
    disarmActiveDrags()
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
    const dx = e.pageX - initialResizeX.current
    const dy = e.pageY - initialResizeY.current
    const candidate = Math.floor(
      initialFontSize.current + (Math.abs(dx) >= Math.abs(dy) ? dx : dy)
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
    initialResizeY.current = e.pageY
    initialFontSize.current = item.value.fontSize
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

  function _cancelDrag() {
    if (!pressed.value) return
    if (dragKind.current === "move" && dragStartPos.current) {
      TextSignal.default.updateTextProperty(itemKey, 'position', { x: dragStartPos.current.x, y: dragStartPos.current.y })
    } else if (dragKind.current === "resize") {
      TextSignal.default.updateTextProperty(itemKey, 'fontSize', initialFontSize.current)
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

  activeDragDisarmers.add(_disarmDrag)
  window.addEventListener('blur', _disarmDrag)
  window.addEventListener('keydown', _handleDragEscape, true)
  window.addEventListener('beforeunload', flushLocalStorage)
  window.addEventListener('pagehide', flushLocalStorage)

  onCleanup(() => {
    pRef.current?.removeEventListener('paste', _handlePaste)
    pRef.current?.removeEventListener('drop', _handleDrop)
    resizeObserver?.disconnect()
    window.removeEventListener('mousemove', _handleMouseMove)
    window.removeEventListener('mouseup', _handleMouseUp)
    window.removeEventListener('mousemove', _handleResizeMove)
    window.removeEventListener('mouseup', _handleResizeMouseUp)
    window.removeEventListener('beforeunload', flushLocalStorage)
    window.removeEventListener('pagehide', flushLocalStorage)
    window.removeEventListener('blur', _disarmDrag)
    window.removeEventListener('keydown', _handleDragEscape, true)
    activeDragDisarmers.delete(_disarmDrag)
    flushLocalStorage()
  })

  function _handleClose(e?: Kiru.MouseEvent<HTMLButtonElement>) {
    e?.stopPropagation()
    const ownMenu = openContextMenu.value
      ? (document.querySelector("#context-menu-portal > div") as HTMLElement | null)
      : null
    const ownMarker = findMinimapMarker(itemKey)
    moveFocusToToolbarAfterDelete(elRef.current, (e?.currentTarget as HTMLElement | null | undefined) ?? null, ownMenu, ownMarker)
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

  function _handleContentInput(e: InputEvent) {
    const el = e.target as HTMLParagraphElement & Pick<HTMLInputElement, 'oninput'>
    const val = _joinChildText(Array.from(el.childNodes), true)
    texts.updateTextProperty(itemKey, 'contents', val)
    _measureAndStoreDimensions()
    updateLocalStorage()
  }

  function _handlePasteImageFiles(files: File[]) {
    files.forEach((file, i) => {
      createImageCardFromFile(file, {
        x: item.value.position.x + i * 24,
        y: item.value.position.y + i * 24
      }, () => toast.showToast("error", "Could not add such a girthy image!"), () => toast.showToast("error", "Could not load that image!"), () => {
        if (elRef.current?.contains(document.activeElement)) {
          focusedItem.value = itemKey
        }
      })
    })
  }

  function _insertPlainText(text: string) {
    const el = pRef.current
    if (!el) return
    const sel = document.getSelection()
    let inserted = false
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      if (el.contains(range.commonAncestorContainer)) {
        range.deleteContents()
        const node = document.createTextNode(text)
        range.insertNode(node)
        range.setStartAfter(node)
        range.setEndAfter(node)
        sel.removeAllRanges()
        sel.addRange(range)
        inserted = true
      }
    }
    if (!inserted) el.appendChild(document.createTextNode(text))
    const val = _joinChildText(Array.from(el.childNodes), true)
    texts.updateTextProperty(itemKey, 'contents', val)
    _measureAndStoreDimensions()
    updateLocalStorage()
  }

  function _insertCompanionText(dt: DataTransfer): boolean {
    const plain = typeof dt.getData === "function" ? dt.getData("text/plain") : ""
    if (!plain) return false
    const lines = plain.split(/\r?\n/).map((l) => l.trim()).filter((l) => !!l && !l.startsWith("#"))
    if (lines.length > 0 && lines.every((l) => l.startsWith("file://"))) return false
    _insertPlainText(plain)
    return true
  }

  function _handlePaste(e: ClipboardEvent) {
    const dt = e.clipboardData
    if (!dt) return
    let files = Array.from(dt.files ?? []).filter((f) => f.type.startsWith("image/"))
    if (!files.length) {
      files = Array.from(dt.items ?? [])
        .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f)
    }
    if (files.length) {
      e.preventDefault()
      _handlePasteImageFiles(files)
      _insertCompanionText(dt)
      return
    }
    const html = typeof dt.getData === "function" ? dt.getData("text/html") : ""
    if (!/<img[\s/>]/i.test(html)) return
    e.preventDefault()
    const dataFiles = imageFilesFromHtml(html)
    if (dataFiles.length) {
      _handlePasteImageFiles(dataFiles)
      _insertCompanionText(dt)
      return
    }
    if (!_insertCompanionText(dt)) {
      toast.showToast("error", "Could not load that image!")
    }
  }

  function _handleDrop(e: DragEvent) {
    const dt = e.dataTransfer
    if (!dt) return
    if ((dt.files ?? []).length) return
    if (Array.from(dt.items ?? []).some((i) => i.kind === "file")) return
    const html = typeof dt.getData === "function" ? dt.getData("text/html") : ""
    if (!/<img[\s/>]/i.test(html)) return
    const plain = typeof dt.getData === "function" ? dt.getData("text/plain").trim() : ""
    if (plain && !/[\r\n]/.test(plain)) {
      const uri = typeof dt.getData === "function"
        ? (dt.getData("text/uri-list").split(/\r?\n/).map((l) => l.trim()).find((l) => !!l && !l.startsWith("#")) ?? "")
        : ""
      if (plain === uri || /^(https?|data|blob):\S+$/i.test(plain)) return
    }
    document.getSelection()?.removeAllRanges()
    _insertCompanionText(dt)
  }

  function _handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault()
      flushLocalStorage()
      return
    }
    if (e.repeat) return
    if ((!e.ctrlKey && !e.metaKey) || e.altKey) return
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
    TextSignal.default.updateTextProperty(itemKey, 'position', newPos)
    updateLocalStorage()
    scrollCardIntoView(newPos, item.value.dimensions)
  }

  function _handleResizeKeyDown(e: KeyboardEvent) {
    if (pressed.value) return
    const prevFontSize = item.value.fontSize
    const newFontSize = arrowKeyResizeFontSize(e, prevFontSize, item.value.dimensions, item.value.position, canvasDimentsion.value)
    if (newFontSize === null) return
    e.preventDefault()
    TextSignal.default.updateTextProperty(itemKey, 'fontSize', newFontSize)
    updateLocalStorage()
    const scale = prevFontSize > 0 ? newFontSize / prevFontSize : 1
    scrollCardIntoView(item.value.position, {
      w: item.value.dimensions.w * scale,
      h: item.value.dimensions.h * scale,
    })
  }

  effect(() => {
    if (openContextMenu.value) focusedItem.value = itemKey
  })

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

  effect(() => {
    if (focusedItem.value !== itemKey) return

    function _handleClick(e: MouseEvent) {
      if (e.button !== 0) return
      if (focusedItem.value !== itemKey) return
      const target = e.target as HTMLElement

      if (target === elRef.current) return
      if (elRef.current?.contains(target)) return
      if (target.closest?.('#context-menu-portal')) return

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
    const menuTitle = cardName || cardSnippet(it.title)

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
        <MenuIcon label={`Text menu${nameSuffix}`} controls={menuId} expanded={openContextMenu.value} onClick={_handleMenuButtonClick} onKeyDown={_handleMenuButtonKeyDown} buttonClass="cursor-pointer w-4 h-4 absolute top-[-8px] left-[-8px] z-10" iconClass="w-4 h-4 block" style={{ display: focusedItem.value === itemKey ? "unset" : "none" }} />
        <HelpIcon onMouseOver={_handleHelpHover} onMouseOut={_handleHelpOut} onClick={_handleHelpClick} describedBy={`text-shortcuts-${itemKey}`} expanded={showHelp.value} label={`Show text shortcuts${nameSuffix}`} buttonClass="cursor-pointer w-4 h-4 absolute top-[-8px] left-[12px] z-10" iconClass="w-4 h-4 block" style={{ display: focusedItem.value === itemKey ? "unset" : "none" }} />
        <CloseIcon cb={_handleClose} itemId={it.id} label={`Delete text${nameSuffix}`} />

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

        <ExpandIcon cb={_handleResizeMouseDown} itemId={it.id} label={`Resize text${nameSuffix}`} />
      </div >

        <ContextMenuPortal open={openContextMenu} closeAction={_handleContextClose} label={`Text menu${nameSuffix}`} menuId={menuId}>
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
                  <button type="button" role="menuitem" aria-label={`Delete text${nameSuffix}`} onclick={_handleClose} className="w-full text-left px-2 py-1 text-md text-[#b3b3b3] group-hover:text-black dark:group-hover:text-[#b3b3b3]">
                    Delete
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </ContextMenuPortal>

        {showHelp.value &&
          <div
            id={`text-shortcuts-${itemKey}`}
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
              <small>arrow keys = move card (shift = 50px)</small>
              <small>alt + arrow keys = resize font (shift = 50px)</small>
            </div>
          </div>
        }
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
        className="text-close cursor-pointer w-4 h-4 absolute top-[-8px] right-[-8px] z-10"
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
