import { EditorView, keymap, highlightSpecialChars, drawSelection, dropCursor } from "@codemirror/view"
import { Compartment, EditorState } from "@codemirror/state"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { markdown } from "@codemirror/lang-markdown"
import { search, searchKeymap } from "@codemirror/search"
import { HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching } from "@codemirror/language"
import { tags } from "@lezer/highlight"
import { effect, onCleanup, onMount, ref } from "kiru"
import { initThemeDetector, isDarkTheme } from "../../utils/useThemeDetector"

export interface MarkDownEditorChange {
  content: string
}

interface MarkDownEditorProps {
  initial: string
  onChange: (e: MarkDownEditorChange) => void
  onFocus?: () => void
}

const editorThemeSpec = {
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: "inherit",
    fontSize: "inherit",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto", fontFamily: "inherit" },
  ".cm-content": { caretColor: "auto", padding: "4px 0" },
  ".cm-line": { padding: "0 4px" },
}

const highlightStyle = HighlightStyle.define([
  { tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6], textTransform: "uppercase", fontWeight: "bold" },
  { tag: tags.processingInstruction, color: "#3b82f6" },
  { tag: tags.monospace, color: "#60a5fa" },
  { tag: [tags.link, tags.url], color: "#3b82f6", textDecoration: "underline" },
  { tag: tags.quote, fontStyle: "italic" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
])

export function MarkDownEditor({ initial, onChange, onFocus }: MarkDownEditorProps) {
  initThemeDetector()
  const elRef = ref<HTMLDivElement>(null)
  const themeCompartment = new Compartment()
  let view: EditorView | undefined

  effect(() => {
    const dark = isDarkTheme.value
    view?.dispatch({
      effects: themeCompartment.reconfigure(
        EditorView.theme(editorThemeSpec, { dark })
      ),
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
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          search(),
          markdown(),
          syntaxHighlighting(highlightStyle),
          themeCompartment.of(EditorView.theme(editorThemeSpec, { dark: isDarkTheme.value })),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ spellcheck: "true", "aria-label": "Note editor" }),
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
  })

  onCleanup(() => view?.destroy())

  return () => (
    <div
      className={'h-full overflow-hidden'}
      ref={elRef}
    ></div>
  )
}
