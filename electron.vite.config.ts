/**
 * Copyright (C) 2024 Dashmake Inc.
 *
 * This file is part of DDoc Office.
 *
 * DDoc Office is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DDoc Office is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
 */

import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'
import react from '@vitejs/plugin-react'
import { sharedAliases } from './vite.alias'
//     "vite-plugin-monaco-editor": "^1.1.0"
// import monacoEditorPlugin from 'vite-plugin-monaco-editor'
import UnoCSS from 'unocss/vite'
import fs from 'node:fs'
// import path from 'node:path';
// import svg  from 'vite-plugin-svgstring';
// import svgLoader from 'vite-plugin-svgstring';

// import monacoEditorPlugin from 'vite-plugin-monaco-editor'
// import tailwind from 'tailwindcss'

// console.log(monacoEditorPlugin)
// const p = monacoEditorPlugin({})

// 1. Read package.json file dynamically
const packageJsonPath = path.resolve(__dirname, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

// 2. Extract production dependencies (ignore devDependencies to keep startup fast)
const allDependencies = Object.keys(packageJson.dependencies || {})

export default defineConfig({
  // root: "src/public",
  main: {
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/main/index.ts'),
          'workers/latexCompile.worker': path.resolve(
            __dirname,
            'src/main/workers/latexCompile.worker.ts'
          )
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    },
    // plugins: []
    // Add rollupOptions to the main configuration
    /* build: {
      rollupOptions: {
        // Explicitly list monaco-editor as external for the Main Process
        external: ['monaco-editor'],
      },
    }, */
    //   build: {
    //   rollupOptions: {
    //     external: ['monaco-editor']
    //   }
    // },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    // plugins: []
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/preload/index.ts'),
          browser: path.resolve(__dirname, 'src/preload/browser.ts'),
          'webview-var': path.resolve(__dirname, 'src/preload/webview-var.ts'),
          'embedded-var': path.resolve(__dirname, 'src/preload/embedded-var.ts')
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    }

    /* plugins: [
      externalizeDepsPlugin(),
      react()
    ],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "src/preload/index.ts"),
          fluent: path.resolve(__dirname, "src/preload/fluent-wrapper.ts")
        },
        output: {
          entryFileNames: "[name].js"
        }
      }
    } */
  },
  renderer: {
    server: {
      // host: '127.0.0.1',
      hmr: false, // 🚫 disable vite hot module replacement for renderer
      // watch: { usePolling: true } // (optional) if you still want file change detection
      watch: {
        ignored: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/assets/fonts/**', // 👈 exclude big folders
          '**/assets/fluentui-system-icons/**',
          '**/assets/**/SVG/**',
          '**/assets/**/PDF/**'
        ]
      }
      /* fs: {
        allow: [
          // allow access to public folder explicitly
          path.resolve(__dirname, 'public'),
          path.resolve(__dirname, 'src/renderer')
        ]
      } */
    },
    plugins: [
      // Desktop only: give the renderer a `Buffer` global before anything else
      // runs. Under contextIsolation there are no Node globals, and roughly
      // eleven renderer modules plus several dependencies call Buffer at
      // runtime; the first call aborts the boot. See
      // src/renderer/src/utils/shims/buffer.ts.
      //
      // Injected here rather than imported from main.ts on purpose: main.ts is
      // shared with the web and mobile builds, which already install the same
      // global from lib/api/web/node.ts. Importing it there would pull the
      // module into their graphs and reshuffle their chunks for no gain. This
      // way their output is untouched, byte for byte.
      (() => {
        const ENTRY = 'src/renderer/src/main.ts'
        let injected = false
        return {
          name: 'ddoc-desktop-buffer-global',
          enforce: 'pre' as const,
          transform(code: string, id: string) {
            if (!id.replace(/\\/g, '/').endsWith(ENTRY)) return null
            injected = true
            return { code: `import './utils/shims/buffer'\n${code}`, map: null }
          },
          buildEnd(this: { error: (m: string) => void }) {
            // Fail the build rather than ship a renderer with no Buffer: a
            // silent miss here reappears as a boot crash under isolation.
            if (!injected) {
              this.error(`ddoc-desktop-buffer-global never matched ${ENTRY}`)
            }
          }
        }
      })(),
      // pdf.js's standalone viewer is vendored at src/renderer/pdfjs and reached
      // as ./pdfjs/web/viewer.html by PdfViewer.svelte. Vite copies
      // src/renderer/public verbatim, but this folder sits beside public/, not
      // inside it, and no build config has ever copied it -- `git log -S pdfjs`
      // over the build files turns up only the npm dependency. So out/renderer
      // has had no pdfjs directory since the folder landed (c74329e8,
      // 2025-12-03) and the viewer has been a 404 in every packaged build. It
      // worked in dev only, where Vite serves the renderer root directly.
      //
      // Copied rather than moved into public/ so the 394 vendored files stay
      // where git already has them, and so the exclusions stay visible in one
      // place: source maps are 9.1 MB of the folder's 20 MB, and
      // compressed.tracemonkey-pldi-09.pdf is pdf.js's own demo document.
      (() => {
        const SOURCE = path.resolve(__dirname, 'src/renderer/pdfjs')
        const DEMO_PDF = 'compressed.tracemonkey-pldi-09.pdf'
        let outDir = ''
        return {
          name: 'ddoc-copy-pdfjs-viewer',
          apply: 'build' as const,
          configResolved(config: { build: { outDir: string } }) {
            outDir = config.build.outDir
          },
          closeBundle(this: { error: (m: string) => void }) {
            const destination = path.join(outDir, 'pdfjs')
            fs.cpSync(SOURCE, destination, {
              recursive: true,
              filter: (from: string) => !from.endsWith('.map') && path.basename(from) !== DEMO_PDF
            })
            // Fail the build rather than ship a viewer that 404s. That is the
            // bug this plugin exists to fix, and it was invisible for months
            // precisely because nothing checked.
            const entry = path.join(destination, 'web', 'viewer.html')
            const worker = path.join(destination, 'build', 'pdf.worker.mjs')
            for (const required of [entry, worker]) {
              if (!fs.existsSync(required)) {
                this.error(`ddoc-copy-pdfjs-viewer did not produce ${required}`)
              }
            }
          }
        }
      })(),
      // svelte(),
      svelte({
        hot: false, // disable Svelte HMR
        compilerOptions: {
          runes: true
        }
      }),
      react(),
      UnoCSS({
        configFile: path.resolve(__dirname, 'uno.config.ts')
      })
      // monacoEditorPlugin.default({}),
      // svg()
      // monacoEditorPlugin({})
    ],
    resolve: {
      dedupe: ['yjs'],
      alias: {
        // Create shorthand for project directories to be used in file importations
        ...sharedAliases,
        '@oxc-parser/binding-wasm32-wasi': path.resolve(
          __dirname,
          'src/renderer/src/utils/shims/empty.ts'
        )
        // svelte: path.resolve('node_modules', 'svelte/src/runtime')
        // '@': path.resolve(__dirname, './src'),
        // 'svelte/internal': path.resolve(__dirname, 'node_modules/svelte/internal'),
        // svelte: path.resolve(__dirname, 'node_modules/svelte')
      }
    },
    optimizeDeps: {
      include: [
        'monaco-editor',
        'react',
        'react-dom',
        '@fluentui/react-components',
        'w3c-keyname'
        // 3. Force-include everything from  dependencies object at cold start
        // ...allDependencies,
        /* '@fluentui/react-datepicker-compat',
        '@assistant-ui/react',
        '@assistant-ui/react-ai-sdk',
        '@assistant-ui/react-markdown',
        'svelte-persisted-store',
        'lodash-es',
        'highlight.js',
        'highlight.js/lib/common',
        'howler',
        'ag-psd',
        'antd',
        'crypto-js',
        'svelte-tiptap',
        'qrcode',
        'echarts',
        '@vscode/vscode-languagedetection',
        'katex',
        'videojs-record',
        'recordrtc' */
      ],
      exclude: ['latex.js', 'rollup', 'fsevents'],
      force: true // <— rebuild dependencies
    },
    ssr: {
      external: ['rollup', 'fsevents'],
      noExternal: ['svelte-i18n']
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        external: ['rollup', 'fsevents'],
        cache: false // Sometimes clearing the cache helps memory during OOM
        // output: {
        // Change the module format from 'cjs' to 'es'
        // format: 'es', // <--- Change this
        // },
      }
    }
  }
})
