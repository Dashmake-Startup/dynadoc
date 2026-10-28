import electronToolkitTs from '@electron-toolkit/eslint-config-ts'
import electronToolkitPrettier from '@electron-toolkit/eslint-config-prettier'
import sveltePlugin from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'

export default [
  {
    ignores: [
      'dist/**',
      'out/**',
      'resources/**',
      'bin/**',
      'ios/**',
      'android/**',
      '**/* copy*',
      '**/*DELETE*',
      '**/*DELETEE*',
      '**/*DELEETE*',
      'src/renderer/src/components/common/react/build-fluent.mjs'
    ]
  },
  ...electronToolkitTs.configs.recommended,
  ...sveltePlugin.configs['flat/recommended'],
  electronToolkitPrettier,
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: electronToolkitTs.parser,
        extraFileExtensions: ['.svelte']
      }
    }
  },
  {
    rules: {
      'svelte/no-unused-svelte-ignore': 'off'
    }
  }
]
