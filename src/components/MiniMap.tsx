import { onMount, signal } from "kiru"
import notes, { NoteCardType } from "../signals/notes"
import { canvasDimentsion, focusedItem } from "../signals"
import { LayerEnum } from "../utils/enums"
import images, { ImageCardType } from "../signals/images"
import texts, { TextCardType } from "../signals/texts"
import { imageCardName, noteCardName } from "../utils/cardName"

const _MAP_OFFSET = 20
const _MAP_SCALE_FACTOR = 10

function _scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
}

export function MiniMap() {
  const scrollX = signal(0)
  const scrollY = signal(0)

  onMount(() => {
    function _handleScroll() {
      scrollX.value = window.scrollX
      scrollY.value = window.scrollY
    }
    _handleScroll()
    window.addEventListener('scroll', _handleScroll)

    return () => window.removeEventListener('scroll', _handleScroll)
  })

  return () => {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight
    const scaleFactor = Math.max(
      _MAP_SCALE_FACTOR,
      canvasDimentsion.value.width / (viewportWidth / 2),
      canvasDimentsion.value.height / (viewportHeight / 2)
    )
    const width = canvasDimentsion.value.width / scaleFactor
    const height = canvasDimentsion.value.height / scaleFactor
    const xPos = Math.max(0, viewportWidth - width - _MAP_OFFSET)
    const yPos = Math.max(0, viewportHeight - height - _MAP_OFFSET)
    const indicatorWidth = viewportWidth / scaleFactor
    const indicatorHeight = viewportHeight / scaleFactor
    const indicatorTop = Math.max(0, Math.min(scrollY.value / scaleFactor, height - indicatorHeight))
    const indicatorLeft = Math.max(0, Math.min(scrollX.value / scaleFactor, width - indicatorWidth))

    return (
      <div
        role="region"
        aria-label="Minimap"
        onmousedown={(e: Kiru.MouseEvent<HTMLDivElement>) => {
          if (e.button !== 0) return
          if (e.target === e.currentTarget) focusedItem.value = null
        }}
        className="dark:bg-[#ffffff11] bg-[#0001] fixed rounded"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          translate: `${xPos}px ${yPos}px`,
          zIndex: `${LayerEnum.MINIMAP}`,
        }}>

        {Object.keys(notes.notes.value).map((noteKey: NoteCardType['id']) => {
          const note = notes.notes.value[noteKey]

          function _handleItemClick() {
            focusedItem.value = noteKey
            const newLeft = note.position.x - ((viewportWidth / 2) - (note.dimensions.w / 2))
            const newTop = note.position.y - ((viewportHeight / 2) - (note.dimensions.h / 2))
            window.scrollTo({
              left: newLeft,
              top: newTop,
              behavior: _scrollBehavior()
            })
          }

          const newWidth = note.dimensions.w / scaleFactor
          const newHeight = note.dimensions.h / scaleFactor
          const newTop = Math.max(0, Math.min(note.position.y / scaleFactor, height - newHeight))
          const newLeft = Math.max(0, Math.min(note.position.x / scaleFactor, width - newWidth))
          const newZIndex = focusedItem.value === noteKey ? LayerEnum.MINIMAP + 2 : LayerEnum.MINIMAP + 1

          return (
            <button type="button" data-minimap-card={noteKey} aria-label={noteCardName(note.title, note.contents) ? `Scroll to note: ${noteCardName(note.title, note.contents)}` : "Scroll to note"} key={noteKey} className={"absolute bg-gray-500 hover:bg-blue-500 cursor-pointer border dark:border-[#222] border-gray-400 rounded"}
              onclick={_handleItemClick}
              style={{
                width: `${newWidth}px`,
                height: `${newHeight}px`,
                top: `${newTop}px`,
                left: `${newLeft}px`,
                zIndex: `${newZIndex}`
              }}
            ></button>
          )
        })}


        {Object.keys(images.images.value).map((imageKey: ImageCardType['id']) => {
          const image = images.images.value[imageKey]

          function _handleItemClick() {
            focusedItem.value = imageKey
            const newLeft = image.position.x - ((viewportWidth / 2) - (image.dimensions.w / 2))
            const newTop = image.position.y - ((viewportHeight / 2) - (image.dimensions.h / 2))

            window.scrollTo({
              left: newLeft,
              top: newTop,
              behavior: _scrollBehavior()
            })
          }

          const newWidth = image.dimensions.w / scaleFactor
          const newHeight = image.dimensions.h / scaleFactor
          const newTop = Math.max(0, Math.min(image.position.y / scaleFactor, height - newHeight))
          const newLeft = Math.max(0, Math.min(image.position.x / scaleFactor, width - newWidth))
          const newZIndex = focusedItem.value === imageKey ? LayerEnum.MINIMAP + 2 : LayerEnum.MINIMAP + 1

          return (
            <button type="button" data-minimap-card={imageKey} aria-label={imageCardName(image.title) ? `Scroll to image: ${imageCardName(image.title)}` : "Scroll to image"} key={imageKey} className={"absolute dark:bg-green-500 bg-green-700 dark:hover:bg-blue-500 hover:bg-blue-500 cursor-pointer border dark:border-[#222] border-green-500 rounded"}
              onclick={_handleItemClick}
              style={{
                width: `${newWidth}px`,
                height: `${newHeight}px`,
                top: `${newTop}px`,
                left: `${newLeft}px`,
                zIndex: `${newZIndex}`
              }}
            ></button>
          )
        })}


        {Object.keys(texts.texts.value).map((textKey: TextCardType['id']) => {
          const text = texts.texts.value[textKey]

          function _handleItemClick() {
            focusedItem.value = textKey
            window.scrollTo({
              left: text.position.x - ((viewportWidth / 2) - (text.dimensions.w / 2)),
              top: text.position.y - ((viewportHeight / 2) - (text.dimensions.h / 2)),
              behavior: _scrollBehavior()
            })
          }

          const newWidth = text.dimensions.w / scaleFactor
          const newHeight = text.dimensions.h / scaleFactor
          const newTop = Math.max(0, Math.min(text.position.y / scaleFactor, height - newHeight))
          const newLeft = Math.max(0, Math.min(text.position.x / scaleFactor, width - newWidth))
          const snippet = text.contents.replace(/\s+/g, " ").trim()
          const textLabel = snippet ? `Scroll to text item: ${snippet.slice(0, 40)}${snippet.length > 40 ? "…" : ""}` : "Scroll to text item"

          return (
            <button type="button" data-minimap-card={textKey} aria-label={textLabel} key={textKey} className={"bg-indigo-500 hover:bg-blue-500 cursor-pointer rounded"}
              onclick={_handleItemClick}
              style={{
                position: 'absolute',
                width: `${newWidth}px`,
                height: `${newHeight}px`,
                top: `${newTop}px`,
                left: `${newLeft}px`,
                border: '1px solid #222',
                zIndex: `${focusedItem.value === textKey ? LayerEnum.MINIMAP + 2 : LayerEnum.MINIMAP + 1}`
              }}
            ></button>
          )
        })}

        <div
          className={'pointer-events-none absolute bg-blue-500/10 border border-blue-500 rounded'}
          style={{
            width: `${indicatorWidth}px`,
            height: `${indicatorHeight}px`,
            top: `${indicatorTop}px`,
            left: `${indicatorLeft}px`,
            zIndex: `${LayerEnum.MINIMAP * 1000}`,
          }}></div>
      </div >
    )
  }
}
