export function createDebounce() {
  let timer: ReturnType<typeof setTimeout> | undefined

  function debounce(func: (...args: unknown[]) => void, timeout = 300) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      func()
    }, timeout)
  }

  function cancel() {
    clearTimeout(timer)
    timer = undefined
  }

  return { debounce, cancel }
}
