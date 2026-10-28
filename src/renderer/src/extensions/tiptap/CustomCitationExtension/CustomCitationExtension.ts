// CustomCitationExtension.ts
import { Node, mergeAttributes } from '@tiptap/core'


import { nodeApi } from '../../../utils/shims/node'
const extensionCitationName = 'citation'
const extensionCitationTagName = 'citation'

export const CustomCitationExtension = Node.create({
  name: extensionCitationName,
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      key: { default: '' },      // citation key, e.g. Smith2020
      label: { default: '' }     // optional short label / preview text
    }
  },

  parseHTML() {
    return [{ tag: extensionCitationTagName }]
    // return [{ tag: 'span[data-type="citation"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    // return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'citation' }), `[@${HTMLAttributes.key || ''}]`]
    return [extensionCitationTagName, mergeAttributes(HTMLAttributes), `[@${HTMLAttributes.key || ''}]`]

  },

  addCommands() {
    return {
      insertCitation:
        (attrs: { key: string; label?: string }) =>
          ({ chain }) => {
            return chain()
              .focus()
              .insertContent({
                type: this.name,
                attrs: { key: attrs.key, label: attrs.label || attrs.key }
              })
              .run()
          }
    }
  },

  addNodeView() {
    // We'll mount a small Svelte component (picker/editor) into the DOM container.
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('span')
      // dom.setAttribute('data-type', 'citation')
      dom.textContent = `[@${node.attrs.key || '??'}]`

      // clicking opens an external picker — we emit a custom event on dom and let the app listen
      dom.addEventListener('click', () => {
        console.log("citation click")
        const ev = new CustomEvent('tiptap-citation-click', { detail: { node, pos: getPos() } })

        console.log("citation click dispatchEvent")
        dom.dispatchEvent(ev)
        console.log("citation click dispatchEvent dns", ev)

        editor.commands.insertBibliography({
          src: `
       @article{Miccadei2002Synergistic,
        journal={Molecular Endocrinology},
 doi={10.1210/MEND.16.4.0808},
 number=4,
 pmid=11923479,
title={{The Synergistic Activity of Thyroid Transcription Factor 1 and Pax 8 Relies on the Promoter/Enhancer Interplay}},
volume=16,
author={Miccadei, Stefania and De Leo, Rossana and Zammarchi, Enrico and Natali, Pier Giorgio and Civitareale, Donato},
pages={837--846},
date={2002-01-01},
year=2002,
month=1,
day=1,
 }`})
      })

      // const component = new CustomCitationExtensionWidget({
      //   target: dom,
      //   props: {
      //     node, bibFilePath,
      //   }
      // })

      return {
        dom,
        update(updated) {
          if (updated.type !== node.type) return false
          // update text
          dom.textContent = `[@${updated.attrs.key || '??'}]`
          return true
        }
      }
    }
  }
})


// CustomBibliographyExtension.ts

const extensionBibliographyName = 'bibliography'
const extensionBibliographyTagName = 'bibliography'
export const CustomBibliographyExtension = Node.create({
  name: extensionBibliographyName,
  group: 'block',
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      src: { default: '' }, // bib file
      style: { default: 'apa' } // CSL style name, e.g. apa, chicago-author-date, etc.
    }
  },

  parseHTML() {
    return [{ tag: extensionBibliographyTagName }]
    // return [{ tag: 'div[data-type="bibliography"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    // return ['div', { 'data-type': 'bibliography', 'data-style': HTMLAttributes.style }, 0]
    return ['div', { 'data-style': HTMLAttributes.style }, 0]
  },

  addCommands() {
    return {
      insertBibliography:
        (attrs: { src: string }) =>
          // (attrs: { key: string; label?: string }) =>
          ({ chain }) => {
            console.log("insertBibliography ", attrs.src)
            return chain()
              .focus()
              .insertContent({
                type: this.name,
                attrs: { src: attrs.src }
              })
              .run()
          }
    }
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      // dom.setAttribute('data-type', 'bibliography')
      dom.classList.add('bibliography')

      // async render function
      const renderBibliography = async () => {
        try {
          console.log("bibliography renderBibliography")
          const bib = node.attrs.src || ''
          // const bib = (nodeApi.fs.existsSync(node.attrs.src)
          //   ? nodeApi.fs.readFileSync(node.attrs.src, 'utf-8')
          //   : null) || ''
          if (!bib.trim()) {
            // if (!bib.trim()) {
            dom.innerHTML = '<p class="text-muted">No bibliography loaded.</p>'
            return
          }

          const CJ = await import('@citation-js/core') // dynamic import
          // const CJPluginibtex = await import('@citation-js/plugin-bibtex') // dynamic import

          // const { default: Cite } = await import('@citation-js/core')
          await import('@citation-js/plugin-bibtex')
          await import('@citation-js/plugin-csl')

          // Parse BibTeX input (can be async)
          const cite = await CJ.Cite.async(bib)

          // construct a Cite object from bibtex; Citation.js supports Cite.async as well
          // We'll use the synchronous parser via new CJ.Cite(bib) if bib is JSON; for bibtex:
          // CJ.plugins.add(CJPluginibtex)
          // const cite = await CJ.Cite.async(bib) // accepts bibtex string
          const html = cite.format('bibliography', {
          // const html = cite.format('bibliography', {
            format: 'html',
            template: node.attrs.style || 'apa',
            lang: 'en-US'
          })
          console.log("bibliography is = ", html)
          dom.innerHTML = html
        } catch (err) {
          console.error("bibliography", err)
          dom.innerHTML = `<pre class="text-red-500">${String(err)}</pre>`
        }
      }

      // initial render
      renderBibliography()

      // optionally watch for bibContent changes (if you want live updates)
      // const unsubs: Array<() => void> = []
      // We can't import Svelte unsubscribe function here easily; instead, rely on external code to call a re-render event.
      // But if you prefer live updates, we could attach listener via window / custom event.
      // For simplicity: re-render on custom event:
      // const reRender = () => renderBibliography()
      // dom.addEventListener('bibliography:rerender', reRender)

      return {
        dom,
        // destroy() {
        //   dom.removeEventListener('bibliography:rerender', reRender)
        // }
      }
    }
  }
})
