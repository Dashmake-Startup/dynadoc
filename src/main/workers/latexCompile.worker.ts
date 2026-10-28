import { execFile } from 'child_process'
import path from 'path'
import { parentPort } from 'worker_threads'

type CompileRequest = {
  texFilePath: string
  tectonicPath: string
}

type CompileLog = {
  type: 'log'
  stream: 'stdout' | 'stderr'
  message: string
}

type CompileDone = {
  type: 'done'
  pdfPath: string
}

type CompileError = {
  type: 'error'
  message: string
}

function send(payload: CompileLog | CompileDone | CompileError) {
  parentPort?.postMessage(payload)
}

parentPort?.on('message', (payload: CompileRequest) => {
  const { texFilePath, tectonicPath } = payload
  if (!texFilePath || !tectonicPath) {
    send({ type: 'error', message: 'Missing texFilePath or tectonicPath.' })
    return
  }

  const outputDir = path.dirname(texFilePath)
  const child = execFile(tectonicPath, ['-o', outputDir, texFilePath])

  child.stdout?.on('data', (data) => {
    send({ type: 'log', stream: 'stdout', message: data.toString() })
  })

  child.stderr?.on('data', (data) => {
    send({ type: 'log', stream: 'stderr', message: data.toString() })
  })

  child.on('error', (err) => {
    send({ type: 'error', message: err?.message || String(err) })
  })

  child.on('close', (code) => {
    if (code === 0) {
      const pdfPath = path.join(outputDir, path.basename(texFilePath, '.tex') + '.pdf')
      send({ type: 'done', pdfPath })
    } else {
      send({ type: 'error', message: `Tectonic failed with exit code ${code ?? 'unknown'}.` })
    }
  })
})
