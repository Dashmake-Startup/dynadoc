// Builds only the preload bundle, reusing the `preload` section of the real
// electron.vite.config.ts rather than a copy of it, so this cannot drift from
// what `electron-vite build` produces. Used by preload-bridge.test.mjs, which
// needs the built preload in a few hundred milliseconds instead of waiting for
// the renderer bundle.
import baseConfig from '../../electron.vite.config'

export default { preload: (baseConfig as { preload: unknown }).preload }
