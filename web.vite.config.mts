import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import UnoCSS from 'unocss/vite'
import path from 'path'
import sveltePreprocess from 'svelte-preprocess'
import { sharedAliases } from './vite.alias'

export default defineConfig({
  server: {
    hmr: false // Disables the WebSocket connection that triggers reloads
    // Optional: if you want to keep HMR but stop full page reloads on error
    // watch: {
    //   ignored: ['**/share-cache/**'] // Ignore your memory-heavy cache folders
    // }
  },
  optimizeDeps: {
    exclude: ['latex.js', 'rollup', 'fsevents']
  },
  plugins: [
    svelte({
      configFile: path.resolve(__dirname, 'svelte.config.mjs'),
      preprocess: sveltePreprocess({
        sourceMap: true,
        typescript: true,
        postcss: false
      }),
      compilerOptions: {
        runes: true
      }
    }),
    UnoCSS({
      configFile: path.resolve(__dirname, 'uno.config.ts')
    })
  ],
  root: './src/renderer',
  // Vite looks for .env* files in envDir, which defaults to `root` -- and
  // src/renderer has none, so without this the web target reads no .env file
  // at all and falls through to the hardcoded production API in baseUrl.ts.
  envDir: __dirname,
  build: {
    outDir: '../../web/dist',
    emptyOutDir: true
  },
  resolve: {
    dedupe: ['yjs'],
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src'),
      ...sharedAliases,
      '@oxc-parser/binding-wasm32-wasi': path.resolve(
        __dirname,
        'src/renderer/src/utils/shims/empty.ts'
      ),
      yazl: path.resolve(__dirname, 'src/renderer/src/utils/shims/yazl.ts'),
      yauzl: path.resolve(__dirname, 'src/renderer/src/utils/shims/yauzl.ts'),
      path: 'path-browserify',
      buffer: 'buffer'
    }
  },
  define: {
    __DDOC_PLATFORM__: JSON.stringify('web'),
    global: 'globalThis',
    'process.env': {},
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    process: { env: {} }
  }
})
