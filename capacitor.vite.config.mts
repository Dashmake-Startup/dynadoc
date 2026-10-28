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
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import UnoCSS from 'unocss/vite'
import path from 'path'
import sveltePreprocess from 'svelte-preprocess'
import { sharedAliases } from './vite.alias'

export default defineConfig({
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
        // postcss: true
      })
    }),
    UnoCSS({
      configFile: path.resolve(__dirname, 'uno.config.ts')
    })
  ],
  root: './src/renderer', // 👈 where index.html lives
  build: {
    outDir: '../../web/dist', // Capacitor requires ./dist
    // outDir: '../../dist/mobile', // Capacitor requires ./dist
    emptyOutDir: true
  },
  resolve: {
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
    __DDOC_PLATFORM__: JSON.stringify('mobile'),
    global: 'globalThis',
    'process.env': {},
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    process: { env: {} }
  }
})

/*
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import UnoCSS from 'unocss/vite'
import sveltePreprocess from 'svelte-preprocess'

export default defineConfig({
  root: './src/renderer',
  build: {
    outDir: '../../dist-mobile',
    emptyOutDir: true,
  },
  plugins: [
    svelte({
      preprocess: sveltePreprocess({
        sourceMap: true,
        typescript: true,
        postcss: true,
      }),
    }),
    UnoCSS(),
  ],
})


*/
