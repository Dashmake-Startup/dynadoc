import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
// import UnoCSS from 'unocss/vite'
// import UnoCSS from '@unocss/svelte-scoped/preprocess'

export default {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: [
    vitePreprocess(),
    // UnoCSS preprocessor https://unocss.dev/integrations/svelte-scoped#install-1
    /* UnoCSS({
      // ... preprocessor options
      combine: false // false in dev mode and true in prod
    }), */
  ]
}


/* export default {
  // Preprocessors
  preprocess: [vitePreprocess()],

  kit: {
    vite: {
      plugins: [
        // UnoCSS plugin (icons, shortcuts, rules)
        UnoCSS()
      ]
    }
  }
} */
