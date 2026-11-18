import { signal } from "kiru"

/** this should be an ID of some card/item */
export const focusedItem = signal<string | null>(null)
export const canvasDimentsion = signal({ width: 3000, height: 3000 })

let boardEpochValue = 0
export function getBoardEpoch() {
  return boardEpochValue
}
export function advanceBoardEpoch() {
  boardEpochValue++
}

export * as NotesSigal from "./notes"
export * as ImagesSignal from "./images"
export * as TextSignal from "./texts"
