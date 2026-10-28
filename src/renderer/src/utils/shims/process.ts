if (typeof window !== 'undefined') {
  const anyWindow = window as any
  if (!anyWindow.process) {
    anyWindow.process = { env: {} }
  } else if (!anyWindow.process.env) {
    anyWindow.process.env = {}
  }

  if (typeof anyWindow.process.cwd !== 'function') {
    anyWindow.process.cwd = () => '/'
  }

  if (!anyWindow.process.platform) {
    anyWindow.process.platform = 'browser'
  }

  if (!anyWindow.process.versions) {
    anyWindow.process.versions = {}
  }

  if (typeof anyWindow.process.browser !== 'boolean') {
    anyWindow.process.browser = true
  }
}
