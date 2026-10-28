type SlideLoadTask<T = any> = () => Promise<T>

type QueueEntry<T = any> = {
  task: SlideLoadTask<T>
  resolve: (value: T) => void
  reject: (err: unknown) => void
}

let _active = 0
let _maxConcurrency = 2
const _queue: QueueEntry[] = []

const pump = () => {
  if (_active >= _maxConcurrency) return
  const next = _queue.shift()
  if (!next) return
  _active += 1
  next
    .task()
    .then((value) => {
      next.resolve(value)
    })
    .catch((err) => {
      next.reject(err)
    })
    .finally(() => {
      _active -= 1
      pump()
    })
}

export const enqueueSlideLoad = <T = any>(task: SlideLoadTask<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    _queue.push({ task, resolve, reject })
    pump()
  })
}

export const setSlideLoadConcurrency = (value: number) => {
  const next = typeof value === 'number' && value > 0 ? Math.floor(value) : 1
  _maxConcurrency = Math.max(1, next)
  pump()
}

