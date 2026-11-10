let pendingEditorFocusId: string | null = null

export function requestEditorFocus(id: string) {
  pendingEditorFocusId = id
}

export function consumeEditorFocus(id: string): boolean {
  if (pendingEditorFocusId !== id) return false
  pendingEditorFocusId = null
  return true
}

export function clearEditorFocusRequest(id: string) {
  if (pendingEditorFocusId === id) pendingEditorFocusId = null
}
