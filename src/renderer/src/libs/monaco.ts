/* import * as monaco from 'monaco-editor'

self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') {
      return new Worker(
        new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url),
        { type: 'module' }
      )
    }
    if (['css', 'scss', 'less'].includes(label)) {
      return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url), {
        type: 'module'
      })
    }
    if (['html', 'handlebars', 'razor'].includes(label)) {
      return new Worker(
        new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url),
        { type: 'module' }
      )
    }
    if (['typescript', 'javascript'].includes(label)) {
      return new Worker(
        new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url),
        { type: 'module' }
      )
    }
    return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url), {
      type: 'module'
    })
  }
}

export default monaco
 */
