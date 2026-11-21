import { EditorView, keymap, highlightSpecialChars, drawSelection, dropCursor, placeholder } from "@codemirror/view"
import { Compartment, EditorState } from "@codemirror/state"
import { defaultKeymap, history, historyKeymap, redo } from "@codemirror/commands"
import { markdown } from "@codemirror/lang-markdown"
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search"
import { HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching } from "@codemirror/language"
import { tags } from "@lezer/highlight"
import { effect, onCleanup, onMount, ref, setup } from "kiru"
import { initThemeDetector, isDarkTheme } from "../../utils/useThemeDetector"
import { imageFilesFromHtml, isImageFileCandidate } from "../../utils/createImageCard"
import { plainTextIsImageAddress } from "../../utils/plainTextIsImageAddress"
import { residualTextFromHtml } from "../../utils/residualTextFromHtml"

export interface MarkDownEditorChange {
  content: string
}

interface MarkDownEditorProps {
  initial: string
  title?: string
  autoFocus?: boolean
  autoFocusCheck?: () => boolean
  onChange: (e: MarkDownEditorChange) => void
  onFocus?: () => void
  onPasteImage?: (files: File[]) => void
  onPasteRejected?: () => void
}

const editorThemeSpec = {
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: "inherit",
    fontSize: "inherit",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-selectionBackground": { backgroundColor: "#3d8ccc" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": { backgroundColor: "#3d8ccc" },
  ".cm-content ::selection": { backgroundColor: "#3d8ccc" },
  ".cm-selectionMatch": { backgroundColor: "#3d8ccc66" },
  ".cm-placeholder": { color: "#6b6b6b" },
  ".cm-scroller": { overflow: "auto", fontFamily: "inherit" },
  ".cm-content": { caretColor: "auto", padding: "4px 0" },
  ".cm-line": { padding: "0 4px" },
}

const editorThemeSpecFor = (dark: boolean) => dark ? {
  ...editorThemeSpec,
  ".cm-dropCursor": { borderLeftColor: "#ddd" },
  ".cm-placeholder": { color: "#9c9c9c" },
  ".cm-panels-top": { borderBottom: "1px solid #808080" },
  ".cm-panels-bottom": { borderTop: "1px solid #808080" },
  ".cm-textfield": { border: "1px solid #808080" },
} : editorThemeSpec

const contentAttributesFor = (label: string) =>
  EditorView.contentAttributes.of({
    spellcheck: "true",
    autocapitalize: "sentences",
    autocorrect: "on",
    "aria-label": label,
  })

const highlightStyleFor = (dark: boolean) => HighlightStyle.define([
  { tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6], textTransform: "uppercase", fontWeight: "bold" },
  { tag: tags.processingInstruction, color: dark ? "#3b82f6" : "#1d4ed8" },
  { tag: tags.monospace, color: dark ? "#60a5fa" : "#1d4ed8" },
  { tag: [tags.link, tags.url], color: dark ? "#3b82f6" : "#1d4ed8", textDecoration: "underline" },
  { tag: tags.quote, fontStyle: "italic" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
])

export function MarkDownEditor(props: MarkDownEditorProps) {
  const { initial, onChange, onFocus, onPasteImage, onPasteRejected, autoFocus, autoFocusCheck } = props
  const $ = setup<MarkDownEditorProps>()
  const titleProp = $.derive((p) => p.title)
  const labelFor = (t?: string) => {
    const trimmed = t?.trim()
    return trimmed ? `Note editor: ${trimmed}` : "Note editor"
  }
  const ariaLabel = labelFor(props.title)
  initThemeDetector()
  const elRef = ref<HTMLDivElement>(null)
  const themeCompartment = new Compartment()
  const highlightCompartment = new Compartment()
  const labelCompartment = new Compartment()
  let view: EditorView | undefined

  effect(() => {
    const label = labelFor(titleProp.value)
    view?.dispatch({
      effects: labelCompartment.reconfigure(contentAttributesFor(label)),
    })
  })

  effect(() => {
    const dark = isDarkTheme.value
    view?.dispatch({
      effects: [
        themeCompartment.reconfigure(
          EditorView.theme(editorThemeSpecFor(dark), { dark })
        ),
        highlightCompartment.reconfigure(
          syntaxHighlighting(highlightStyleFor(dark))
        ),
      ],
    })
  })

  onMount(() => {
    if (!elRef.current) return
    view = new EditorView({
      parent: elRef.current,
      state: EditorState.create({
        doc: initial,
        extensions: [
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          keymap.of([{ key: "Mod-Shift-z", run: redo, preventDefault: true }, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          search(),
          highlightSelectionMatches(),
          placeholder("Type here…"),
          markdown({ pasteURLAsLink: false }),
          highlightCompartment.of(syntaxHighlighting(highlightStyleFor(isDarkTheme.value))),
          themeCompartment.of(EditorView.theme(editorThemeSpecFor(isDarkTheme.value), { dark: isDarkTheme.value })),
          EditorView.lineWrapping,
          labelCompartment.of(contentAttributesFor(ariaLabel)),
          EditorView.domEventHandlers({
            paste: (event, editorView) => {
              if (!onPasteImage) return false
              let files = Array.from(event.clipboardData?.files ?? []).filter(isImageFileCandidate)
              if (!files.length && event.clipboardData) {
                files = Array.from(event.clipboardData.items)
                  .filter((i) => i.kind === "file" && (i.type.startsWith("image/") || i.type === ""))
                  .map((i) => i.getAsFile())
                  .filter((f): f is File => !!f && isImageFileCandidate(f))
              }
              let pastedHtml = ""
              if (!files.length && event.clipboardData && typeof event.clipboardData.getData === "function") {
                pastedHtml = event.clipboardData.getData("text/html")
                if (/<img[\s/>]/i.test(pastedHtml)) files = imageFilesFromHtml(pastedHtml)
              }
              if (!files.length) {
                const hasFiles = (event.clipboardData?.files?.length ?? 0) > 0 ||
                  Array.from(event.clipboardData?.items ?? []).some((i) => i.kind === "file")
                if (!hasFiles) {
                  if (!/<img[\s/>]/i.test(pastedHtml)) return false
                  if (residualTextFromHtml(pastedHtml)) return false
                  const dt = event.clipboardData
                  const plain = typeof dt?.getData === "function" ? dt.getData("text/plain") : ""
                  if (plain.trim()) {
                    const uriList = typeof dt?.getData === "function" ? dt.getData("text/uri-list") : ""
                    if (!plainTextIsImageAddress(plain, uriList)) return false
                  }
                  onPasteRejected?.()
                  event.preventDefault()
                  return true
                }
                onPasteRejected?.()
                event.preventDefault()
                return true
              }
              onPasteImage(files)
              const dt = event.clipboardData
              const plainText = typeof dt?.getData === "function" ? dt.getData("text/plain") : ""
              const uriList = typeof dt?.getData === "function" ? dt.getData("text/uri-list") : ""
              let text = plainText || uriList
              if (text && plainText && plainTextIsImageAddress(plainText, uriList)) {
                text = ""
              }
              if (text && !plainText) {
                const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => !!l && !l.startsWith("#"))
                if (lines.length > 0 && lines.every((l) => l.startsWith("file://"))) {
                  text = ""
                }
              }
              let fromHtml = false
              if (!text) {
                const htmlText = pastedHtml || (typeof dt?.getData === "function" ? dt.getData("text/html") : "")
                if (/<img[\s/>]/i.test(htmlText)) {
                  const residual = residualTextFromHtml(htmlText)
                  if (residual && !plainTextIsImageAddress(residual, uriList)) {
                    text = residual
                    fromHtml = true
                  }
                }
              }
              if (!text) {
                event.preventDefault()
                return true
              }
              if (fromHtml) {
                event.preventDefault()
                const sel = editorView.state.selection.main
                editorView.dispatch({
                  changes: { from: sel.from, to: sel.to, insert: text },
                  selection: { anchor: sel.from + text.length },
                  userEvent: "input.paste",
                })
                return true
              }
              return false
            },
            drop: (event, editorView) => {
              if (!onPasteImage) return false
              let files = Array.from(event.dataTransfer?.files ?? []).filter(isImageFileCandidate)
              if (!files.length && event.dataTransfer) {
                files = Array.from(event.dataTransfer.items)
                  .filter((i) => i.kind === "file" && (i.type.startsWith("image/") || i.type === ""))
                  .map((i) => i.getAsFile())
                  .filter((f): f is File => !!f && isImageFileCandidate(f))
              }
              let draggedHtml = ""
              if (!files.length && event.dataTransfer && typeof event.dataTransfer.getData === "function") {
                draggedHtml = event.dataTransfer.getData("text/html")
                if (/<img[\s/>]/i.test(draggedHtml)) files = imageFilesFromHtml(draggedHtml)
              }
              if (!files.length) {
                const hasFiles = (event.dataTransfer?.files?.length ?? 0) > 0 ||
                  Array.from(event.dataTransfer?.items ?? []).some((i) => i.kind === "file")
                if (hasFiles) return true
                if (/<img[\s/>]/i.test(draggedHtml)) {
                  const residualText = residualTextFromHtml(draggedHtml)
                  if (residualText) {
                    const dt = event.dataTransfer
                    const plain = typeof dt?.getData === "function" ? dt.getData("text/plain") : ""
                    const uriList = typeof dt?.getData === "function" ? dt.getData("text/uri-list") : ""
                    if (plain.trim() && !plainTextIsImageAddress(plain, uriList)) return false
                    if (plainTextIsImageAddress(residualText, uriList)) return false
                    event.preventDefault()
                    editorView.focus()
                    let pos = editorView.state.selection.main.head
                    if (typeof event.clientX === "number" && typeof event.clientY === "number") {
                      try {
                        pos = editorView.posAtCoords({ x: event.clientX, y: event.clientY }) ?? pos
                      } catch {
                        pos = editorView.state.selection.main.head
                      }
                    }
                    editorView.dispatch({
                      changes: { from: pos, insert: residualText },
                      selection: { anchor: pos + residualText.length },
                      userEvent: "input.drop",
                    })
                    return true
                  }
                  const plain = typeof event.dataTransfer?.getData === "function" ? event.dataTransfer.getData("text/plain") : ""
                  const plainTrim = plain.trim()
                  if (plainTrim) {
                    const uriList = typeof event.dataTransfer?.getData === "function" ? event.dataTransfer.getData("text/uri-list") : ""
                    if (!plainTextIsImageAddress(plain, uriList)) return false
                  }
                  event.preventDefault()
                  return true
                }
                return false
              }
              event.preventDefault()
              editorView.focus()
              const dt = event.dataTransfer
              let text = typeof dt?.getData === "function" ? dt.getData("text/plain") : ""
              if (text) {
                const uriList = typeof dt?.getData === "function" ? dt.getData("text/uri-list") : ""
                const trimmed = text.trim()
                if (plainTextIsImageAddress(text, uriList) || (!!uriList && trimmed === uriList.trim())) {
                  text = ""
                }
              }
              if (!text) {
                const htmlText = draggedHtml || (typeof dt?.getData === "function" ? dt.getData("text/html") : "")
                if (/<img[\s/>]/i.test(htmlText)) {
                  const residual = residualTextFromHtml(htmlText)
                  const uriList = typeof dt?.getData === "function" ? dt.getData("text/uri-list") : ""
                  if (residual && !plainTextIsImageAddress(residual, uriList)) text = residual
                }
              }
              let pos = editorView.state.selection.main.head
              if (text && typeof event.clientX === "number" && typeof event.clientY === "number") {
                try {
                  pos = editorView.posAtCoords({ x: event.clientX, y: event.clientY }) ?? pos
                } catch {
                  pos = editorView.state.selection.main.head
                }
              }
              onPasteImage(files)
              if (text) {
                editorView.dispatch({
                  changes: { from: pos, insert: text },
                  selection: { anchor: pos + text.length },
                  userEvent: "input.drop",
                })
              }
              return true
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.focusChanged && update.view.hasFocus) {
              onFocus?.()
            }
            if (update.docChanged) {
              onChange({ content: update.state.doc.toString() })
            }
          }),
        ],
      }),
    })
    if (autoFocus && (autoFocusCheck?.() ?? true)) view.focus()
  })

  onCleanup(() => view?.destroy())

  return () => (
    <div
      className={'h-full overflow-hidden'}
      ref={elRef}
    ></div>
  )
}
