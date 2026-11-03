import { onMount, ref } from "kiru"
import { ImagesSignal, NotesSigal, TextSignal, canvasDimentsion } from "../signals"
import { NoteCard } from "./NoteCard"
import notes from "../signals/notes"
import { MiniMap } from "./MiniMap"
import { ImageCard } from "./ImageCard"
import images from "../signals/images"
import { CardSelector } from "./cardSelector/CardSelector"
import { Logo } from "./Logo"
import { useThemeDetector } from "../utils/useThemeDetector"
import { TextItem } from "./TextItem"
import texts from "../signals/texts"
import { createDebounce } from "../utils/useDebounce"

export default function InfiniteCanvas() {
  const containerRef = ref<HTMLDivElement>(null)
  const { debounce } = createDebounce()

  onMount(() => {
    const initPos = getInitialPosition(canvasDimentsion)
    window.scrollTo(initPos)

    const _updateDimensions = () => {
      canvasDimentsion.value = {
        width: Math.max(canvasDimentsion.value.width, window.innerWidth),
        height: Math.max(canvasDimentsion.value.height, window.innerHeight),
      }
    }

    function _updatePosition() {
      debounce(() => {
        localStorage.setItem("pos", JSON.stringify({
          left: window.scrollX,
          top: window.scrollY
        }))
      })
    }

    function _preventFileDropNavigation(e: DragEvent) {
      e.preventDefault()
    }

    _updateDimensions()
    window.addEventListener("resize", _updateDimensions)
    window.addEventListener("scroll", _updatePosition)
    window.addEventListener("dragover", _preventFileDropNavigation)
    window.addEventListener("drop", _preventFileDropNavigation)
    notes.loadLocalStorage()
    images.loadLocalStorage()
    texts.loadLocalStorage()

    return () => {
      window.removeEventListener("resize", _updateDimensions)
      window.removeEventListener("scroll", _updatePosition)
      window.removeEventListener("dragover", _preventFileDropNavigation)
      window.removeEventListener("drop", _preventFileDropNavigation)
    }
  })

  return () => {
    const isDarkTheme = useThemeDetector()

    return (
      <>
        <Logo />
        <CardSelector />
        <MiniMap />

        <div
          className="h-screen w-full absolute top-0 left-0"
        >
          <div
            className="dark:bg-black absolute top-0 left-0"
            ref={containerRef}
            style={{
              width: `${canvasDimentsion.value.width}px`,
              height: `${canvasDimentsion.value.height}px`,
              backgroundSize: "30px 30px",
              backgroundImage: `radial-gradient(circle, rgba(${isDarkTheme ? '255, 255, 255, 0.2' : '0, 0, 0, 0.2'}) 1px, transparent 1px)`,
            }}>
            {Object.keys(NotesSigal.default.notes.value).map((itemKey: string) => {
              const item = NotesSigal.default.notes.value[itemKey]
              return (
                <NoteCard key={itemKey} itemKey={itemKey} data={item} />
              )
            })}

            {Object.keys(ImagesSignal.default.images.value).map((itemKey: string) => {
              const item = ImagesSignal.default.images.value[itemKey]
              return (
                <ImageCard key={itemKey} itemKey={itemKey} data={item} />
              )
            })}

            {Object.keys(TextSignal.default.texts.value).map((itemKey: string) => {
              const item = TextSignal.default.texts.value[itemKey]
              return (
                <TextItem key={itemKey} itemKey={itemKey} data={item} />
              )
            })}

          </div>
        </div>
      </>
    )
  }
}

interface ScrollToOptions extends ScrollOptions {
  left?: number;
  top?: number;
}

function getInitialPosition(canvasDimensions: typeof canvasDimentsion): ScrollToOptions {
  const defaultScroll: ScrollToOptions = {
    left: (canvasDimensions.value.width / 2) - (window.innerWidth / 2),
    top: (canvasDimensions.value.height / 2) - (window.innerHeight / 2)
  }

  let initPosition;
  try {
    initPosition = JSON.parse(localStorage.getItem("pos") ?? "")
  } catch (e) {
    console.error("no local storage for pos " + e)
  }

  if (!initPosition) return defaultScroll
  return initPosition
}
