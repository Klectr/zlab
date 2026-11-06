export function createFileFromData(
  data: string,
  name: string,
  type: BlobPropertyBag["type"]
) {
  return new File([data], name, {
    type: type,
  })
}
