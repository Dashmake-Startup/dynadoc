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
// uno.config.ts
// https://unocss.dev/integrations/svelte-scoped#configuration
import { defineConfig, presetIcons, presetUno, transformerDirectives, transformerVariantGroup } from 'unocss'
import { presetDaisy } from 'unocss-preset-daisy'
// import phIcons from '@iconify-json/ph/icons.json'

// import phIconsJson from '@iconify-json/ph/icons.json'

// const phIcons = phIconsJson as unknown as { icons: Record<string, any> }

// console.log(Object.keys(phIcons.icons)) // verify keys like 'copy', 'text-align-justify'

export default defineConfig({
  presets: [
    presetUno(), // ⭐ enables dark: variants and utility classes
    /* presetDaisy({
      themes: [
        {
          dark: {
            "base-100": "rgb(30, 30, 30)",
            "base-content": "#f3f2f1",
            // ... other colors
          },
        },
      ],
    }), */
  ],
  transformers: [
    transformerVariantGroup(), // <-- Add this line
  ],
  // dark: 'class', // ⭐ Enable class-based dark mode (like Tailwind)
  // ...UnoCSS options
  // presets: [
  //   // presetUno(),
  //   /* presetIcons({
  //     // use Phosphor icons; you can mix sets
  //     collections: {
  //       // leave empty to use Iconify CDN collections automatically
  //     },
  //     scale: 1.1
  //   }) */
  //   /* presetIcons({
  //     prefix: 'i-', // use `i-ph-copy` in your HTML
  //     scale: 1.2,
  //     collections: {
  //       ph: () => import('@iconify-json/ph/icons.json').then((i) => i.icons)
  //     }
  //   }) */
  //   /* presetIcons({
  //     prefix: 'i-', // allows <div class="i-ph-copy"></div>
  //     scale: 1.2,
  //     collections: {
  //       ph: phIcons.icons
  //     }
  //   }) */
  // ],

  /*
  presets: [
    // ✅ Use only icons, no presetUno (to avoid duplicating Tailwind utilities)
    presetIcons({
      prefix: 'i-', // usage: <div class="i-ph-copy"></div>
      scale: 1.2,
      collections: {
        // Example: add phosphor icons
        ph: () => import('@iconify-json/ph/icons.json').then((i) => i.icons),
      },
    }),
  ],

  */
  theme: {
    /* colors: {
      'dark-bg': '#333',
      'dark-border': '#454545',
      'light-bg': '#fff',
      'classic-bg': '#f5f5dc'
    } */
    /* font-sans resolves to UnoCSS's default stack unless it is declared here,
       and the root containers carry `font-sans` — which silently overrode
       --brand-font-sans on almost every element. */
    fontFamily: {
      sans: 'var(--brand-font-sans)'
    },
    colors: {
      dark: {
        bg: '#333', //  Dark theme background color
        border: '#454545'
      },
      light: {
        bg: '#fff', // Light theme background color
        border: '#f5f5dc'
      },
      classic: {
        bg: '#f5f5dc' // Classic theme background color
      }
    }
  },
  shortcuts: {
    // Shortcut for dark border
    'border-dark': 'border-[theme(colors.dark.border)]',
    'bg-dark': 'bg-[theme(colors.dark.bg)]',

    // Light and classic can also have shortcuts
    'border-light': 'border-[theme(colors.light.border)]',
    'bg-light': 'bg-[theme(colors.light.bg)]',
    'bg-classic': 'bg-[theme(colors.classic.bg)]',
    'scrollbar-ribbon': `
    scrollbar-thin
    [&::-webkit-scrollbar]:h-1.5
    [&::-webkit-scrollbar-thumb]:bg-gray-500
    [&::-webkit-scrollbar-thumb]:rounded-full
  `
    // 'theme-dark': 'bg-dark-bg',
    // 'theme-light': 'bg-light-bg',
    // 'theme-classic': 'bg-classic-bg'
  },
  rules: [
    // Match classes like w-80px, w-100px etc. Support also syntax like w-2 -> default behavior
    // [/^w-([.\d]+)$/, ([_, num]) => ({ width: `${num}px` })],

    [/^w-([\d.]+)(px)?$/, ([_, num, unit]) => {
      const val = parseFloat(num)
      return unit === 'px'
        ? { width: `${val}px` }
        : { width: `${val / 4}rem` }
    }],

    // Max-Width Rule: Handles max-w-80px and max-w-2
    [/^max-w-([\d.]+)(px)?$/, ([_, num, unit]) => {
      const val = parseFloat(num)
      return unit === 'px'
        ? { 'max-width': `${val}px` }
        : { 'max-width': `${val / 4}rem` }
    }],

    // Min-Width Rule: Handles min-w-80px and min-w-2
    [/^min-w-([\d.]+)(px)?$/, ([_, num, unit]) => {
      const val = parseFloat(num)
      return unit === 'px'
        ? { 'min-width': `${val}px` }
        : { 'min-width': `${val / 4}rem` }
    }],

    // Match classes like max-w-80px, max-w-100px, etc.
    // [/^max-w-([.\d]+)$/, ([_, num]) => ({ 'max-width': `${num}px` })],

    // Match classes like min-w-80px, min-w-100px, etc.
    // [/^min-w-([.\d]+)$/, ([_, num]) => ({ 'min-width': `${num}px` })]
  ],

  /*   rules: [
      // Add a catch-all prefixed rule
      [
        /^u-(.*)$/,
        ([, c]) => {
          // For example, convert `u-w-120px` -> { width: "120px" }
          if (c.startsWith('w-')) return { width: `${c.slice(2)}` }
          if (c.startsWith('max-w-')) return { 'max-width': `${c.slice(6)}` }
          if (c.startsWith('min-w-')) return { 'min-width': `${c.slice(6)}` }
          return {}
        }
      ]
    ], */
  /* transformers: [
    transformerDirectives() // allows @apply u-* in component CSS
  ] */
  transformers: [
    transformerDirectives()
  ]
})
