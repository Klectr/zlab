export function convertBase64ToJson(
  data: string | ArrayBuffer | null | undefined
) {
  try {
    if (!data) throw new Error("no data to decode")
    if (data instanceof ArrayBuffer)
      throw new Error("cannot decode array buffer yet")
    const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
    const jsonString = new TextDecoder("utf-8").decode(bytes)

    const jsonObject = JSON.parse(jsonString)

    return jsonObject
  } catch (error) {
    console.error("Error decoding Base64:", error)
  }
}
