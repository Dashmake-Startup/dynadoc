import toast from "svelte-hot-french-toast"
import EditorCommonUtils from "../../utils/common.utils"



function ensureToastStyles(TOAST_STYLE_ID: string = 'office-export-toast-styles') {
  if (document.getElementById(TOAST_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = TOAST_STYLE_ID
  style.textContent = `
    .office-export-toast {
      position: fixed;
      right: 20px;
      bottom: 24px;
      z-index: 10000;
      min-width: 320px;
      max-width: 420px;
      background: rgba(20, 20, 20, 0.95);
      color: #f3f4f6;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(10px);
      opacity: 0;
      transform: translateY(12px);
      transition: opacity 160ms ease, transform 160ms ease;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .office-export-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    .office-export-toast .title {
      font-weight: 600;
      letter-spacing: 0.3px;
      font-size: 13px;
    }
    .office-export-toast .path {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.6);
      word-break: break-all;
      line-height: 1.3;
    }
    .office-export-toast .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .office-export-toast .btn {
      border: none;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 11px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      transition: background 120ms ease, transform 120ms ease;
    }
    .office-export-toast .btn.primary {
      background: rgba(59, 130, 246, 0.9);
      color: #fff;
    }
    .office-export-toast .btn:hover {
      background: rgba(255, 255, 255, 0.16);
      transform: translateY(-1px);
    }
    .office-export-toast .btn.primary:hover {
      background: rgba(37, 99, 235, 0.9);
    }
  `
  document.head.appendChild(style)
}

export function showExportToast(payload: {
  id: string
  title: string
  path: string
  onOpen: () => void
  onReveal: () => void
}) {
  ensureToastStyles(payload.id)
  toast.success(payload.title)


  const customToast = document.createElement('div')
  customToast.className = 'office-export-toast'
  customToast.innerHTML = `
    <div class="title">${payload.title}</div>
    <div class="path">${payload.path}</div>
    <div class="actions">
      <button class="btn primary" data-action="open">Open</button>
      <button class="btn" data-action="reveal">Show in Folder</button>
      <button class="btn" data-action="copy">Copy Path</button>
      <button class="btn" data-action="dismiss">Dismiss</button>
    </div>
  `

  const cleanup = () => {
    customToast.classList.remove('show')
    setTimeout(() => customToast.remove(), 160)
  }

  customToast.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement
    const action = target?.dataset?.action
    if (!action) return
    if (action === 'open') payload.onOpen()
    if (action === 'reveal') payload.onReveal()
    if (action === 'copy') {
      try {
        await EditorCommonUtils.copyToClipboard(payload.path)
      } catch {
        // ignore clipboard failures
      }
    }
    if (action === 'dismiss') cleanup()
  })

  document.body.appendChild(customToast)
  requestAnimationFrame(() => customToast.classList.add('show'))
  setTimeout(cleanup, 9000)
}
