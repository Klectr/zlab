import { onMount, ref, signal } from "kiru"
import notes, { NoteCardType } from "../signals/notes"
import { canvasDimentsion } from "../signals"
import { LayerEnum } from "../utils/enums"
import images, { ImageCardType } from "../signals/images"
import texts, { TextCardType } from "../signals/texts"

const _MAP_OFFSET = 20
const _MAP_SCALE_FACTOR = 10
const _defaults = { width: 0, height: 0 }

export function MiniMap() {
  const el = ref<HTMLDivElement>(null)
  const scrollX = signal(0)
  const scrollY = signal(0)

  onMount(() => {
    function _handleScroll() {
      scrollX.value = window.scrollX
      scrollY.value = window.scrollY
    }
    window.addEventListener('scroll', _handleScroll)

    return () => window.removeEventListener('scroll', _handleScroll)
  })

  return () => {
    const elMeta = el.current?.getBoundingClientRect() ?? _defaults
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const xPos = viewportWidth - elMeta?.width - _MAP_OFFSET
    const yPos = viewportHeight - elMeta.height - _MAP_OFFSET
    const width = canvasDimentsion.value.width / _MAP_SCALE_FACTOR
    const height = canvasDimentsion.value.height / _MAP_SCALE_FACTOR

    return (
      <div
        className="dark:bg-[#ffffff11] bg-[#0001] fixed rounded"
        ref={el} style={{
          width: `${width}px`,
          height: `${height}px`,
          translate: `${xPos}px ${yPos}px`,
          zIndex: `${LayerEnum.MINIMAP}`,
        }}>

        {Object.keys(images.images.value).map((imageKey: ImageCardType['id']) => {
          const image = images.images.value[imageKey]

          function _handleItemClick() {
            const newLeft = image.position.x - ((viewportWidth / 2) - (image.dimensions.w / 2))
            const newTop = image.position.y - ((viewportHeight / 2) - (image.dimensions.h / 2))

            window.scrollTo({
              left: newLeft,
              top: newTop,
              behavior: 'smooth'
            })
          }

          const newWidth = image.dimensions.w / _MAP_SCALE_FACTOR
          const newHeight = image.dimensions.h / _MAP_SCALE_FACTOR
          const newTop = (image.position.y / _MAP_SCALE_FACTOR)
          const newLeft = (image.position.x / _MAP_SCALE_FACTOR)
          const newZIndex = LayerEnum.MINIMAP + 1

          return (
            <div key={imageKey} className={"absolute dark:bg-green-500 bg-green-300 dark:hover:bg-blue-500 hover:bg-blue-300 cursor-pointer border dark:border-[#222] border-green-500 rounded"}
              onclick={_handleItemClick}
              style={{
                width: `${newWidth}px`,
                height: `${newHeight}px`,
                top: `${newTop}px`,
                left: `${newLeft}px`,
                zIndex: `${newZIndex}`
              }}
            ></div>
          )
        })}


        {Object.keys(notes.notes.value).map((noteKey: NoteCardType['id']) => {
          const note = notes.notes.value[noteKey]

          function _handleItemClick() {
            const newLeft = note.position.x - ((viewportWidth / 2) - (note.dimensions.w / 2))
            const newTop = note.position.y - ((viewportHeight / 2) - (note.dimensions.h / 2))
            window.scrollTo({
              left: newLeft,
              top: newTop,
              behavior: 'smooth'
            })
          }

          const newWidth = note.dimensions.w / _MAP_SCALE_FACTOR
          const newHeight = note.dimensions.h / _MAP_SCALE_FACTOR
          const newTop = (note.position.y / _MAP_SCALE_FACTOR)
          const newLeft = (note.position.x / _MAP_SCALE_FACTOR)
          const newZIndex = LayerEnum.MINIMAP + 1

          return (
            <div key={noteKey} className={"absolute dark:bg-gray-500 bg-gray-300 hover:bg-blue-500 cursor-pointer border dark:border-[#222] border-gray-400 rounded"}
              onclick={_handleItemClick}
              style={{
                width: `${newWidth}px`,
                height: `${newHeight}px`,
                top: `${newTop}px`,
                left: `${newLeft}px`,
                zIndex: `${newZIndex}`
              }}
            ></div>
          )
        })}

        {Object.keys(texts.texts.value).map((textKey: TextCardType['id']) => {
          const text = texts.texts.value[textKey]

          function _handleItemClick() {
            window.scrollTo({
              left: text.position.x - ((viewportWidth / 2) - (text.dimensions.w / 2)),
              top: text.position.y - ((viewportHeight / 2) - (text.dimensions.h / 2)),
              behavior: 'smooth'
            })
          }

          return (
            <div key={textKey} className={"bg-indigo-500 hover:bg-blue-500 cursor-pointer rounded"}
              onclick={_handleItemClick}
              style={{
                position: 'absolute',
                width: `${text.dimensions.w / _MAP_SCALE_FACTOR}px`,
                height: `${text.dimensions.h / _MAP_SCALE_FACTOR}px`,
                top: `${(text.position.y / _MAP_SCALE_FACTOR)}px`,
                left: `${(text.position.x / _MAP_SCALE_FACTOR)}px`,
                border: '1px solid #222',
                zIndex: `${LayerEnum.MINIMAP + 1}`
              }}
            ></div>
          )
        })}

        <div
          className={'pointer-events-none absolute bg-blue-500/10 border dark:border-blue-800 border-blue-500 rounded'}
          style={{
            width: `${viewportWidth / _MAP_SCALE_FACTOR}px`,
            height: `${viewportHeight / _MAP_SCALE_FACTOR}px`,
            top: `${scrollY.value / _MAP_SCALE_FACTOR}px`,
            left: `${scrollX.value / _MAP_SCALE_FACTOR}px`,
            zIndex: `${LayerEnum.MINIMAP * 1000}`,
          }}></div>
      </div >
    )
  }
}
