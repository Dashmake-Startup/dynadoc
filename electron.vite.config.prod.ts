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
import monacoEditorPlugin from 'vite-plugin-monaco-editor'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  // ▶ MAIN PROCESS (Node)
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: true,                     // ⬅ Minify main process
      sourcemap: false,
      esbuildOptions: {
        drop: ["console", "debugger"]
      }
    }
  },

  // ▶ PRELOAD (Bridges renderer <-> main)
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/preload/index.ts')
        },
        output: {
          entryFileNames: '[name].js'
        }
      },
      esbuild: {
        drop: ['console', 'debugger'],
        platform: 'node'
      }
    }
  },

  // ▶ RENDERER (Browser – Svelte/React/Monaco/UnoCSS)
  renderer: {
    server: {
      hmr: false,
      watch: {
        ignored: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/assets/fonts/**',
          '**/assets/fluentui-system-icons/**',
          '**/assets/**/SVG/**',
          '**/assets/**/PDF/**'
        ]
      }
    },

    plugins: [
      svelte({ hot: false }),
      react(),
      monacoEditorPlugin.default({}),
      // UnoCSS(),  // If needed, put back
    ],

    resolve: {
      alias: {
        rootDir: path.resolve(__dirname, ''),
        builtInExtensionsDir: path.resolve(__dirname, 'extensions'),
        srcDir: path.resolve(__dirname, 'src'),
        assetsDir: path.resolve(__dirname, 'src/renderer/src/assets'),
        assetsImgDir: path.resolve(__dirname, 'src/renderer/src/assets/img')
      }
    },

    optimizeDeps: {
      include: [
        'monaco-editor',
        'react',
        'react-dom',
        '@fluentui/react-components'
      ],
      exclude: ['latex.js', 'rollup', 'fsevents'],
      force: true,
    },

    ssr: {
      external: ['rollup', 'fsevents'],
    },

    build: {
      minify: 'esbuild',               // ⬅ Fastest & smallest
      sourcemap: false,
      target: 'es2020',
      rollupOptions: {
        external: ['rollup', 'fsevents']
      },
      esbuild: {
        drop: ['console', 'debugger'], // ⬅ Remove all console + debugger
      }
    }
  }
})

