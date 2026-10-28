export function open() {
  throw new Error(
    'yauzl is not available in web/mobile builds. Use window.api.unddocify instead.'
  )
}

export default {
  open
}

