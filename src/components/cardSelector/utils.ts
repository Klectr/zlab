export const defaultClassName =
  "cursor-pointer w-5 h-5 text-[#9c9c9c] hover:text-blue-500 transition-color duration-300"

export function clickSpawnPoint(e: {
  pageX: number
  pageY: number
  clientX: number
  clientY: number
}) {
  if (e.pageX !== 0 || e.pageY !== 0 || e.clientX !== 0 || e.clientY !== 0)
    return { pageX: e.pageX, pageY: e.pageY }
  return {
    pageX: window.scrollX + window.innerWidth / 2,
    pageY: window.scrollY,
  }
}
