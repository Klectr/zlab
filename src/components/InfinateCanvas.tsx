import { onMount, ref } from "kiru"
import { ImagesSignal, NotesSigal, TextSignal, canvasDimentsion, focusedItem } from "../signals"
import { NoteCard } from "./NoteCard"
import notes from "../signals/notes"
import { MiniMap } from "./MiniMap"
import { ImageCard } from "./ImageCard"
import images from "../signals/images"
import { CardSelector } from "./cardSelector/CardSelector"
import { Logo } from "./Logo"
import { useThemeDetector } from "../utils/useThemeDetector"
import { createImageCardFromFile, imageFilesFromHtml } from "../utils/createImageCard"
import { disarmActiveDrags } from "../utils/activeDrag"
import { useToast } from "./Toast"
import { TextItem } from "./TextItem"
import texts from "../signals/texts"
import { createDebounce } from "../utils/useDebounce"

export default function InfiniteCanvas() {
  const containerRef = ref<HTMLDivElement>(null)
  const { debounce } = createDebounce()
  const toast = useToast()

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
        try {
          localStorage.setItem("pos", JSON.stringify({
            left: window.scrollX,
            top: window.scrollY
          }))
        } catch {
          return
        }
      })
    }

    function _flushPosition() {
      try {
        localStorage.setItem("pos", JSON.stringify({
          left: window.scrollX,
          top: window.scrollY
        }))
      } catch {
        return
      }
    }

    function _disarmDragsOnMouseDown(e: MouseEvent) {
      if (e.button !== 0 && (e.buttons & 1) !== 0) return
      disarmActiveDrags()
    }

    function _preventFileDropNavigation(e: DragEvent) {
      e.preventDefault()
    }

    function _handleFileDrop(e: DragEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest?.("#minimap, #card-selector, #context-menu-portal, #toast-root")) {
        e.preventDefault()
        return
      }
      const dt = e.dataTransfer
      let allFiles = Array.from(dt?.files ?? [])
      if (!allFiles.length && dt) {
        allFiles = Array.from(dt.items ?? [])
          .filter((i) => i.kind === "file")
          .map((i) => i.getAsFile())
          .filter((f): f is File => !!f)
      }
      let files = allFiles.filter((f) => f.type.startsWith("image/"))
      const html = !allFiles.length && dt && typeof dt.getData === "function" ? dt.getData("text/html") : ""
      const hasDraggedImage = /<img[\s/>]/i.test(html)
      if (!allFiles.length && target?.closest?.(".text-p")) {
        if (!hasDraggedImage) return
        e.preventDefault()
        files = imageFilesFromHtml(html)
        if (!files.length) {
          toast.showToast("error", "Could not load that image!")
          return
        }
      } else {
        e.preventDefault()
        if (allFiles.length > 0 && files.length === 0) {
          toast.showToast("error", "Only image files can be dropped.")
          return
        }
        if (target?.closest?.(".cm-editor")) return
        if (!files.length) {
          files = imageFilesFromHtml(html)
          if (!files.length) {
            const residualText = html
              .replace(/<img[\s/>][^>]*>/gi, "")
              .replace(/<[^>]+>/g, "")
              .replace(/&[a-z#0-9]+;/gi, " ")
              .trim()
            if (residualText) return
            const uriList = dt && typeof dt.getData === "function" ? dt.getData("text/uri-list") : ""
            const firstUri = uriList.split(/\r?\n/).map((l) => l.trim()).find((l) => !!l && !l.startsWith("#")) ?? ""
            const uriIsImage = /\.(?:png|jpe?g|gif|webp|avif|svg|bmp|ico|tiff?)(?:[?#].*)?$/i.test(firstUri)
            if (!hasDraggedImage && !uriIsImage) return
            toast.showToast("error", "Only image files can be dropped.")
            return
          }
        }
      }
      files.forEach((file, i) => {
        createImageCardFromFile(file, {
          x: Math.max(0, e.pageX - 100 + i * 24),
          y: Math.max(0, e.pageY - 100 + i * 24)
        }, () => toast.showToast("error", "Could not add such a girthy image!"), () => toast.showToast("error", "Could not load that image!"))
      })
    }

    _updateDimensions()
    window.addEventListener("mousedown", _disarmDragsOnMouseDown, true)
    window.addEventListener("resize", _updateDimensions)
    window.addEventListener("scroll", _updatePosition)
    window.addEventListener("dragover", _preventFileDropNavigation)
    window.addEventListener("drop", _handleFileDrop)
    window.addEventListener("beforeunload", _flushPosition)
    window.addEventListener("pagehide", _flushPosition)
    notes.loadLocalStorage()
    images.loadLocalStorage()
    texts.loadLocalStorage()

    return () => {
      window.removeEventListener("mousedown", _disarmDragsOnMouseDown, true)
      window.removeEventListener("resize", _updateDimensions)
      window.removeEventListener("scroll", _updatePosition)
      window.removeEventListener("dragover", _preventFileDropNavigation)
      window.removeEventListener("drop", _handleFileDrop)
      window.removeEventListener("beforeunload", _flushPosition)
      window.removeEventListener("pagehide", _flushPosition)
      _flushPosition()
    }
  })

  return () => {
    const isDarkTheme = useThemeDetector()

    return (
      <>
        <Logo />
        <CardSelector />

        <main aria-label="Board">
        <div
          className="h-screen w-full absolute top-0 left-0"
        >
          <div
            className="dark:bg-black absolute top-0 left-0"
            ref={containerRef}
            onmousedown={(e: Kiru.MouseEvent<HTMLDivElement>) => {
              if (e.button !== 0) return
              if (e.target === containerRef.current) focusedItem.value = null
            }}
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
        </main>
        <MiniMap />
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

  if (
    !initPosition ||
    typeof initPosition !== "object" ||
    Array.isArray(initPosition) ||
    !Number.isFinite(initPosition.left) ||
    !Number.isFinite(initPosition.top)
  )
    return defaultScroll
  return {
    left: Math.max(0, initPosition.left),
    top: Math.max(0, initPosition.top),
  }
}
