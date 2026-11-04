import { createFileCompliantDateString } from "./createFileCompliantDateString"
import { createFileFromData } from "./createFileFromData"

export type acceptableFileTypes = "text/json" | "text/markdown"
export function createFileAndExport(
  name: string,
  data: string,
  type: acceptableFileTypes
) {
  const date = createFileCompliantDateString()
  const fileName = `${name}_${date}.${_getFileType(type)}`
  const file = createFileFromData(data, fileName, type)
  const url = URL.createObjectURL(file)
  const a = document.createElement("a")
  a.download = fileName
  a.href = url
  a.click()
  URL.revokeObjectURL(url)
}

function _getFileType(type: acceptableFileTypes): "json" | "md" {
  if (type === "text/markdown") return "md"
  return "json"
}
