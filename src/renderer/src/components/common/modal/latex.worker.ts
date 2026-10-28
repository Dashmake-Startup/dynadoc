import { HtmlGenerator, parse } from 'webtex'

self.onmessage = (event: MessageEvent) => {
  const content = event?.data?.content ?? ''
  try {
    const generator = new HtmlGenerator({ hyphenate: false })
    const doc = parse(content, { generator }).htmlDocument()
    const bodyHtml = doc?.body?.innerHTML || ''
    ;(self as unknown as Worker).postMessage({ type: 'preview:ok', html: bodyHtml })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({
      type: 'preview:error',
      error: String(err)
    })
  }
}
