import { Node } from '@tiptap/core'
import { mount } from 'svelte';
import { v4 as uuidv4 } from 'uuid'

import CryptoJS from 'crypto-js'
import * as OTPAuth from 'otpauth'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Node as ProseMirrorNode } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'

export interface SecuredContentOptions {
  protectionPaneHTMLContainerRoot: HTMLElement | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    CustomSecuredContentExtension: {
      setSecuredContent: (options?: SecuredContentPolicy | 'inline' | 'block') => ReturnType
      unsetSecuredContent: (content?: string, pos?: number, wrapperId?: string) => ReturnType
      toggleSecuredContent: (options?: SecuredContentPolicy | 'inline' | 'block') => ReturnType
      updateSecuredContentPolicy: (pos: number, policy: Partial<SecuredContentPolicy>) => ReturnType
      applySecuredContentPolicy: (policy: SecuredContentPolicy) => ReturnType
    }
  }
}

let inlineTagName = 'shield',
  // let inlineTagName = 's',
  blockTagName = 'shield'

// import { Decoration } from 'prosemirror-view'
import CustomSecuredContentExtensionWidget from './components/CustomSecuredContentExtensionWidget.svelte'
import { normalizeStringLength } from './utils/Utils';
const pluginKey = new PluginKey(inlineTagName)

export type SecuredScope =
  | 'selection'
  | 'word'
  | 'sentence'
  | 'paragraph'
  | 'section'
  | 'document'

export type ShieldMethod = 'blur' | 'lock' | 'hidden'
export type SecurityMethod = null | 'password' | '2fa' | 'biometric'

export interface SecuredContentPolicy {
  scope?: SecuredScope
  shieldMethod?: ShieldMethod
  securityMethod?: SecurityMethod
  securitySecret?: string
  type?: 'inline' | 'block'
  author?: string
  includeUsers?: string[]
  excludeUsers?: string[]
  includeGroups?: string[]
  excludeGroups?: string[]
}

type Range = { from: number; to: number }

function parseJSONList(value: any): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string')
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function uniqueRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges]
    .filter((range) => range.from < range.to)
    .sort((a, b) => a.from - b.from || a.to - b.to)
  const out: Range[] = []
  let lastKey = ''
  for (const range of sorted) {
    const key = `${range.from}:${range.to}`
    if (key === lastKey) continue
    lastKey = key
    out.push(range)
  }
  return out
}

function normalizeWrappedBraces(input: string): string {
  const raw = (input ?? '').toString()
  if (!raw) return raw
  const leading = raw.match(/^\{+/)?.[0]?.length ?? 0
  const trailing = raw.match(/\}+$/)?.[0]?.length ?? 0
  if (leading >= 2 && trailing >= 2) {
    return raw.replace(/^\{+/, '').replace(/\}+$/, '')
  }
  return raw
}

function getTextBlockRanges(doc: ProseMirrorNode, from: number, to: number): Range[] {
  const ranges: Range[] = []
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return
    const start = pos + 1
    const end = pos + node.content.size
    if (start >= end) return
    ranges.push({ from: start, to: end })
  })
  return uniqueRanges(ranges)
}

function splitByWord(doc: ProseMirrorNode, from: number, to: number): Range[] {
  const source = doc.textBetween(from, to, '', '')
  if (!source) return []
  const ranges: Range[] = []
  const regex = /\b[\p{L}\p{N}_'-]+\b/gu
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(source)) !== null) {
    const start = from + match.index
    const end = start + match[0].length
    ranges.push({ from: start, to: end })
  }
  return uniqueRanges(ranges)
}

function splitBySentence(doc: ProseMirrorNode, from: number, to: number): Range[] {
  const source = doc.textBetween(from, to, '', '')
  if (!source) return []
  const ranges: Range[] = []
  const regex = /[^.!?\n]+[.!?]?/g
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(source)) !== null) {
    const raw = match[0]
    const leftTrim = raw.length - raw.trimStart().length
    const rightTrim = raw.length - raw.trimEnd().length
    const text = raw.trim()
    if (!text) continue
    const start = from + match.index + leftTrim
    const end = from + match.index + raw.length - rightTrim
    if (start < end) ranges.push({ from: start, to: end })
  }
  return uniqueRanges(ranges)
}

function resolveSecuredRanges(
  state: any,
  scope: SecuredScope
): Range[] {
  const { from, to, empty } = state.selection
  const doc: ProseMirrorNode = state.doc

  if (scope === 'document') {
    return getTextBlockRanges(doc, 0, doc.content.size)
  }

  if (scope === 'selection') {
    if (!empty && from < to) return [{ from, to }]
    return []
  }

  const baseFrom = empty ? Math.max(0, from - 1) : from
  const baseTo = empty ? Math.min(doc.content.size, to + 1) : to

  if (scope === 'paragraph' || scope === 'section') {
    return getTextBlockRanges(doc, baseFrom, baseTo)
  }

  if (scope === 'word') {
    const seedRanges = empty ? getTextBlockRanges(doc, baseFrom, baseTo) : [{ from, to }]
    return uniqueRanges(seedRanges.flatMap((range) => splitByWord(doc, range.from, range.to)))
  }

  if (scope === 'sentence') {
    const seedRanges = empty ? getTextBlockRanges(doc, baseFrom, baseTo) : [{ from, to }]
    return uniqueRanges(seedRanges.flatMap((range) => splitBySentence(doc, range.from, range.to)))
  }

  return []
}

export const CustomSecuredContentExtension = Node.create({
  // export const CustomSecuredContentExtension = Extension.create({
  // name: 'customSecuredContentExtension',
  name: inlineTagName,
  inline: true,
  atom: true,
  selectable: true,
  group: 'inline',

  addOptions() {
    return {
      protectionPaneHTMLContainerRoot:null
      // type: 'inline',
      // blockTagName: inlineTagName,
      // caretColor: '#f97316',
      // attributeName: 'value'
    }
  },
  addAttributes() {
    // return { value: { default: '' } }
    return {
      value: { default: '' },
      marks: { default: [] }, // inline marks. For text style
      context: { default: [] }, // parent node info
      author: { default: null },
      // disabled: { default: true },
      deletable: { default: false },
      styleWidth: { default: '' }, // the width to apply to the tag to match the original value length
      shieldMethod: { default: "lock" }, // "blur" | "visible"| "hidden" // hidden hide the tag like programming style comment
      securityMethod: { default: null },  // null | "password" | "2fa"
      securitySecret: { default: '' },    // exported TOTP secret as string
      decryptedValue: { default: '' },    // decripted value after user succesfully authenticate. NEVER put this in renderHTML() to avoid saviing the decrypted text in the file
      originalValueLength: { default: null },    // the length of the original value before the encryption
      includeUsers: { default: [] },
      excludeUsers: { default: [] },
      includeGroups: { default: [] },
      excludeGroups: { default: [] },
    }
  },

  parseHTML() {
    return [
      {
        tag: inlineTagName,
        getAttrs: (el) => ({
          value: el.getAttribute('value') || '',
          includeUsers: parseJSONList(el.getAttribute('includeUsers')),
          excludeUsers: parseJSONList(el.getAttribute('excludeUsers')),
          includeGroups: parseJSONList(el.getAttribute('includeGroups')),
          excludeGroups: parseJSONList(el.getAttribute('excludeGroups'))
        })
      }
    ]
  },
  renderHTML({ node }) {
    return [
      inlineTagName,
      // { value: node.attrs.value, class: 'secured-content block' }
      {
        value: node.attrs.value,
        // marks: JSON.stringify(node.attrs.marks),
        // context: JSON.stringify(node.attrs.context),
        marks: Array.isArray(node.attrs.marks)
          ? JSON.stringify(node.attrs.marks)
          : node.attrs.marks,
        context: Array.isArray(node.attrs.context)
          ? JSON.stringify(node.attrs.context)
          : node.attrs.context,
        author: node.attrs.author || '',
        class: 'secured-content glass group',
        // class: 'secured-content glass group blur-md select-text'
        // class: 'secured-content block'
        // disabled: { default: true },
        deletable: node.attrs.deletable,
        styleWidth: node.attrs.styleWidth,
        shieldMethod: node.attrs.shieldMethod,
        securityMethod: node.attrs.securityMethod,
        securitySecret: node.attrs.securitySecret,
        originalValueLength: node.attrs.originalValueLength,
        includeUsers: JSON.stringify(node.attrs.includeUsers || []),
        excludeUsers: JSON.stringify(node.attrs.excludeUsers || []),
        includeGroups: JSON.stringify(node.attrs.includeGroups || []),
        excludeGroups: JSON.stringify(node.attrs.excludeGroups || []),
        // decryptedValue : NEVER put this in renderHTML() to avoid saviing the decrypted text in the file

      },
      // 0
    ]
  },

   /*  onCreate({ editor }) {
     
      let protectionPaneHTMLContainerRoot = this.options.protectionPaneHTMLContainerRoot
      if (!protectionPaneHTMLContainerRoot) {
        console.warn('[NodeLimit] protectionPaneHTMLContainerRoot not found')
        return
      }
  
      // 3️⃣ Create placeholder container
      const container = document.createElement('div')
      container.className = 'node-limit-warning-container'
      protectionPaneHTMLContainerRoot.prepend(container)
  
      // 4️⃣ Create reactive props (if you want to update component dynamically)
      const props = $state({
        // nodeCounts: get(nodeCounts),
      })
  
      // Reactively sync Svelte store updates into props
      const unsubscribe = nodeCounts.subscribe(($counts) => {
        // props.nodeCounts = $counts
      })
  
      // 5️⃣ Mount the Svelte component
      const component = mount(LimitToolbar, {
        // const component = mount(LimitWarning, {
        target: container,
        props,
      })
  
      console.log('✅ [NodeLimit] Warning component mounted', { component, editor, container })
  
      // 6️⃣ Cleanup when extension is destroyed
      editor.on('destroy', () => {
        unsubscribe?.()
        if (component) unmount(component)
        container?.remove()
      })
    }, */

  addNodeView() {

    return ({ node, editor, getPos }) => {

      const wrapperId = `secured-content-wrapper-${uuidv4()}`
      // if (node.type.name === blockTagName) {
      // const deco = Decoration.widget(pos, () => {
      // const deco = Decoration.widget(pos + 1, () => {
      const wrapper = document.createElement('span')
      wrapper.classList.add(
        'secured-content-wrapper',
        'relative',
        'inline-block',
        'group'
      )
      wrapper.id = wrapperId
      // this.storage.securedContentWrapperId = id

      const hasDecryptedValue = Boolean(node.attrs?.decryptedValue)
      const visualMethod: ShieldMethod = (node.attrs?.shieldMethod || 'lock') as ShieldMethod
      const policyConfigured = Boolean(node.attrs?.securityMethod)
      const sourceValue = hasDecryptedValue ? node.attrs?.decryptedValue : node.attrs?.value || ''
      let maskWidth: number | null = null
      if (visualMethod === 'hidden' && !hasDecryptedValue) {
        try {
          const len = Number(node.attrs?.originalValueLength || sourceValue.length || 8)
          const measureText = 'M'.repeat(Math.max(1, len))
          const measurer = document.createElement('span')
          measurer.style.position = 'absolute'
          measurer.style.visibility = 'hidden'
          measurer.style.whiteSpace = 'pre'
          measurer.style.font = window.getComputedStyle(editor.view.dom).font
          measurer.textContent = measureText
          editor.view.dom.appendChild(measurer)
          maskWidth = measurer.getBoundingClientRect().width
          measurer.remove()
        } catch {
          maskWidth = null
        }
      }
      const maskedValue =
        visualMethod === 'hidden' && !hasDecryptedValue
          ? '█'.repeat(Math.max(4, Number(node.attrs?.originalValueLength || sourceValue.length || 8)))
          : normalizeStringLength(sourceValue, node.attrs?.originalValueLength)
      const protectedContent = maskedValue
      mount(CustomSecuredContentExtensionWidget, {
        // new CustomSecuredContentExtensionWidget({
        target: wrapper,
        props: {
          __wrapperId: wrapperId,
          __protectionPaneHTMLContainerRoot: this.options.protectionPaneHTMLContainerRoot,
          __protectedContent: protectedContent,
          __node: node,
          __editor: editor,
          __getPos: getPos,
          __author: node.attrs.author || 'Unknown',
          __text: node.attrs.value || '',
          __shieldMethod: visualMethod,
          __securityMethod: node.attrs.securityMethod,
          __maskWidth: maskWidth,
          __policyConfigured: policyConfigured,
          __onUnset: () => {
            this.editor.commands.unsetSecuredContent(node.attrs?.decryptedValue || node.attrs?.value || '', getPos(), wrapperId)
          }
        }
      })

      // return wrapper
      // })

      // decos.push(deco)
      // }
      return { dom: wrapper }
      // return { dom: wrapper, destroy: unsubscribe }
    }
  },

  addStorage() {
    return {
      // securedContentWrapperId: '',
      encrypt(text: string, key: string) {
        return CryptoJS.AES.encrypt(text, key).toString()
      },
      decrypt(cipher: string, key: string) {
        try {
          return CryptoJS.AES.decrypt(cipher, key).toString(CryptoJS.enc.Utf8)
        } catch {
          return false
          // return 'Invalid key'
        }
      },

      // --- OTPAuth version ---
      generateTOTP() {
        const totp = new OTPAuth.TOTP({
          issuer: 'MyDocument',
          label: 'Shield',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        })

        return {
          totp,
          secret: totp.secret.base32,
          uri: totp.toString(), // otpauth://totp/...
        }
      },

      verifyTOTP(secret: string, token: string) {
        const totp = new OTPAuth.TOTP({
          secret: OTPAuth.Secret.fromBase32(secret),
          issuer: 'MyDocument',
          label: 'Shield',
        })

        const delta = totp.validate({ token })
        return delta !== null // true when valid
      },
    }
  },

  addCommands() {
    return {
      setSecuredContent:
        (options: SecuredContentPolicy | 'inline' | 'block' = {}) =>
          ({ state, dispatch, editor }) => {
            const normalizedPolicy: SecuredContentPolicy =
              typeof options === 'string'
                ? { type: options }
                : options || {}

            const scope = normalizedPolicy.scope || 'selection'
            const shieldMethod: ShieldMethod = (normalizedPolicy.shieldMethod || 'lock') as ShieldMethod
            const securityMethod: SecurityMethod = (normalizedPolicy.securityMethod ?? null) as SecurityMethod
            const securitySecret = normalizedPolicy.securitySecret || ''
            const author = normalizedPolicy.author || 'Security System'
            const includeUsers = Array.isArray(normalizedPolicy.includeUsers)
              ? normalizedPolicy.includeUsers
              : []
            const excludeUsers = Array.isArray(normalizedPolicy.excludeUsers)
              ? normalizedPolicy.excludeUsers
              : []
            const includeGroups = Array.isArray(normalizedPolicy.includeGroups)
              ? normalizedPolicy.includeGroups
              : []
            const excludeGroups = Array.isArray(normalizedPolicy.excludeGroups)
              ? normalizedPolicy.excludeGroups
              : []

            const ranges = resolveSecuredRanges(state, scope)
            if (!ranges.length) return false

            const sortedRanges = [...ranges].sort((a, b) => b.from - a.from)
            let tr = state.tr
            let appliedCount = 0

            for (const range of sortedRanges) {
              const selectedTextRaw = state.doc.textBetween(
                range.from,
                range.to,
                '\n',
                (node) => {
                  if (node.isText) return node.text || ''
                  if (node.isAtom) {
                    const name =
                      node.attrs?.name ?? node.attrs?.label ?? node.attrs?.value ?? node.type?.name
                    return name ? `{${name}}` : ''
                  }
                  return ''
                }
              )
              const selectedText = normalizeWrappedBraces(selectedTextRaw.trim())
              if (!selectedText) continue

              let marks: any[] = []
              let context: any[] = []

              state.doc.nodesBetween(range.from, range.to, (node) => {
                if (node.marks?.length && marks.length === 0) {
                  marks = node.marks.map((mark) => mark.toJSON())
                }
              })

              const $from = state.doc.resolve(range.from)
              for (let depth = $from.depth; depth > 0; depth -= 1) {
                const parentNode = $from.node(depth)
                if (!parentNode?.attrs) continue
                context.push({
                  type: parentNode.type.name,
                  attrs: parentNode.attrs
                })
              }

              const encryptedValue =
                securityMethod === 'password' && securitySecret
                  ? editor.storage.shield.encrypt(selectedText, securitySecret)
                  : selectedText

              const replacementNode = state.schema.nodes.shield.create(
                {
                  value: encryptedValue,
                  marks,
                  context,
                  author,
                  shieldMethod,
                  securityMethod,
                  securitySecret: securityMethod ? securitySecret : '',
                  decryptedValue: '',
                  originalValueLength: selectedText.length,
                  includeUsers,
                  excludeUsers,
                  includeGroups,
                  excludeGroups
                },
                state.schema.text(normalizeStringLength(selectedText, selectedText.length))
              )

              tr = tr.replaceRangeWith(range.from, range.to, replacementNode)
              appliedCount += 1
            }

            if (appliedCount === 0) return false
            if (dispatch) dispatch(tr)
            return true
          },

      unsetSecuredContent:
        (content: string = "", pos?: number, wrapperId?: string) =>
          ({ state, dispatch }) => {
            const fallbackPos = state.selection?.from || 0
            const effectivePos = typeof pos === 'number' && Number.isFinite(pos) ? pos : fallbackPos

            const $pos = state.doc.resolve(effectivePos)
            const node: ProseMirrorNode | null = $pos.nodeAfter

            if (!node) return false
            if (node.type.name !== inlineTagName) return false

            // const value = node.attrs.value
            // if (!value) return false

            const marksData = !Array.isArray(node.attrs.marks)
              ? JSON.parse(node.attrs.marks)
              : node.attrs.marks || []

            // Restore marks
            const marks = marksData.map((m) => state.schema.markFromJSON(m))
            // let content: any = { type: 'text', text: value, marks }
            // console.log('unsetSecuredContent marks', marks, content)

            // const marksData = node.attrs.marks || []
            // const marks = marksData.map((m) => state.schema.markFromJSON(m))

            const textNode = state.schema.text(content, marks)
            // const textNode = state.schema.text(node.attrs.value, marks)




            // Restore parent wrapping nodes
            /* for (let i = contextData.length - 1; i >= 0; i--) {
                const ctx = contextData[i]
                console.log('unsetSecuredContent ctx', ctx, ctx.attrs)
                content = {
                  type: ctx.type,
                  attrs: ctx.attrs
                  // content: [content]
                }
              } */
            const tr = state.tr.replaceWith(
              effectivePos,
              effectivePos + node.nodeSize,
              textNode
              // state.schema.nodeFromJSON(content.marks)
            )
            if (dispatch) dispatch(tr)
            return true
            // const tr = state.tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(value))

            // if (dispatch) dispatch(tr)
            // return true
          },
      toggleSecuredContent:
        (options: SecuredContentPolicy | 'inline' | 'block' = {}) =>
          ({ state, commands }) => {
            const from = state.selection?.from || 0
            const node = state.doc.resolve(from).nodeAfter
            const isShieldNode = node?.type?.name === inlineTagName

            if (isShieldNode) {
              return commands.unsetSecuredContent(node.attrs?.value || '', from, '')
            }

            return commands.setSecuredContent(options)
          },
      updateSecuredContentPolicy:
        (pos: number, policy: Partial<SecuredContentPolicy> = {}) =>
          ({ state, dispatch }) => {
            const $pos = state.doc.resolve(pos)
            const node: ProseMirrorNode | null = $pos.nodeAfter
            if (!node || node.type.name !== inlineTagName) return false

            const nextAttrs = {
              ...node.attrs,
              ...(policy.shieldMethod ? { shieldMethod: policy.shieldMethod } : {}),
              ...(policy.securityMethod !== undefined ? { securityMethod: policy.securityMethod } : {}),
              ...(policy.securitySecret !== undefined ? { securitySecret: policy.securitySecret } : {}),
              ...(policy.author ? { author: policy.author } : {}),
              ...(policy.includeUsers ? { includeUsers: policy.includeUsers } : {}),
              ...(policy.excludeUsers ? { excludeUsers: policy.excludeUsers } : {}),
              ...(policy.includeGroups ? { includeGroups: policy.includeGroups } : {}),
              ...(policy.excludeGroups ? { excludeGroups: policy.excludeGroups } : {})
            }

            const tr = state.tr.setNodeMarkup(pos, undefined, nextAttrs, node.marks)
            if (dispatch) dispatch(tr)
            return true
          },
      applySecuredContentPolicy:
        (policy: SecuredContentPolicy) =>
          ({ commands }) => {
            return commands.setSecuredContent(policy)
          },
      setBackUncyptedOriginalContent:
        (content: string = "", from: number, wrapperId: string) => ({ tr, state, dispatch, editor }) => {
          // (enabled: boolean, author?: string) => ({ tr, state, dispatch, editor }) => {

          editor.commands.unsetSecuredContent(content, from, wrapperId)
          // if (dispatch) dispatch(state.tr.setMeta(pluginKey, { content: content, from: from, wrapperId: wrapperId }))
          return true
        },
    }
  },



  addProseMirrorPlugins() {
    const that = this
    // const pluginKey = new PluginKey(inlineTagName)


    return [
      new Plugin<any>({
        key: pluginKey,

        state: {
          init: (_, { doc }) => {
            return {
              decorations: DecorationSet.empty,
            }
          },

          apply(tr, value, oldState, newState) {
            let decs = value.decorations.map(tr.mapping, tr.doc)

            // handle local adds
            const meta = tr.getMeta(pluginKey)
            return { decorations: decs }
            if (meta && meta.content) {
              // if (meta && meta.add && Array.isArray(meta.add)) {
              // meta.add.forEach((d: ReviewDec) => {
              // const cls = d.kind === 'insert' ? that.options.insertClass : that.options.deleteClass



              const wrapper = document.getElementById(meta.wrapperId)
              wrapper.classList.add("!hidden")

              const deco = Decoration.widget(meta.from, () => {
                const insert = document.createElement("span");
                insert.className = "uncrypted-text";
                insert.textContent = meta.content;
                return insert;
              });


              // const start = Decoration.widget(d.from, () => {
              //   const span = document.createElement("span");
              //   span.className = "suggestion-start";
              //   span.textContent = "";
              //   return span;
              // });

              // const end = Decoration.widget(d.to, () => {
              //   const span = document.createElement("span");
              //   span.className = "suggestion-end";
              //   span.textContent = "";
              //   return span;
              // });


              // const dom = document.createElement('span')
              // const deco = Decoration.inline(d.from, d.to,
              //   { class: cls, dom })

              //                                 const getText = () => newState.doc.textBetween(d.from, d.to)
              // const deco = createSvelteDecoration(d, getText)


              decs = decs.add(tr.doc, [deco])
              // decs = decs.add(tr.doc, [deco])
              // sync to Yjs map
              // that.storage.reviewMap?.set(d.id, d)
              // })
            }

            if (meta && meta.clearAll) {
              decs = DecorationSet.empty
              that.storage.reviewMap?.clear()
            }

            // sync decorations from Yjs for remote changes

            /* if (that.storage.reviewMap) {
                that.storage.reviewMap.forEach((d: ReviewDec) => {
                    const exists = decs.find(undefined, undefined, deco => deco.spec?.['data-review-id'] === d.id)
                    if (exists.length === 0) {
                        const cls = d.kind === 'insert' ? that.options.insertClass : that.options.deleteClass
                        const deco = Decoration.inline(d.from, d.to, {
                            class: cls,
                            dom
                        })
                        decs = decs.add(newState.doc, [deco])
                    }
                })
            } */


            /* if (that.storage.reviewMap) {
                that.storage.reviewMap.forEach((d: ReviewDec) => {
                    console.log("deco storage ", decs)
                    const exists = decs.find(undefined, undefined, deco => deco.spec['data-review-id'] === d.id)
                    if (exists.length === 0) {
                        const cls = d.kind === 'insert' ? that.options.insertClass : that.options.deleteClass
                        const deco = Decoration.inline(d.from, d.to, { class: cls, 'data-review-id': d.id, 'data-review-kind': d.kind, 'data-review-author': d.author || '' })
                        decs = decs.add(newState.doc, [deco])
                    }
                })
            } */

            return { decorations: decs }
          },
        },

        props: {
          decorations(state) {
            return this.getState(state).decorations
          },
        },

        view(editorView) {
          ; (that as any).editor = (that as any).editor || (editorView as any).props?.editor || null
          return {}
        },
      }),
    ]
  },

  //   addProseMirrorPlugins() {
  //     return [
  //       new Plugin({
  //         props: {
  //           decorations: (state) => {
  //             const decos: Decoration[] = []



  //             state.doc.descendants((node, pos) => {
  //               if (node.type.name === blockTagName) {
  //                 const deco = Decoration.widget(pos, () => {
  //                   // const deco = Decoration.widget(pos + 1, () => {
  //                   const wrapper = document.createElement('span')
  //                   wrapper.classList.add(
  //                     'secured-content-wrapper',
  //                     'relative',
  //                     'inline-block',
  //                     'group'
  //                   )

  //                   // The blurred word
  //                   const wordEl = document.createElement('span')
  //                   wordEl.textContent = node.textContent || 'Very secured'
  //                   wordEl.classList.add('relative', 'select-text', 'px-1')

  //                   // overlay div
  //                   const overlay = document.createElement('div')
  //                   overlay.classList.add(
  //                     'overlay',
  //                     'absolute',
  //                     'inset-0',
  //                     'bg-white/50',
  //                     'backdrop-blur-sm',
  //                     'pointer-events-none',
  //                     'rounded',
  //                     'transition-all',
  //                     'duration-200',
  //                     'group-hover:hidden' // reveal on hover
  //                   )

  //                   wrapper.appendChild(wordEl)
  //                   wrapper.appendChild(overlay)

  //                   // Optional: mount your Svelte widget (author, buttons, etc.)

  //                   mount(CustomSecuredContentExtensionWidget, {
  //                     // new CustomSecuredContentExtensionWidget({
  //                     target: wrapper,
  //                     props: {
  //                       __author: node.attrs.author || 'Unknown',
  //                       __text: node.attrs.value || '',
  //                       __onUncomment: () => {
  //                         this.editor.commands.unsetSecuredContent(pos)
  //                       }
  //                     }
  //                   })

  //                   return wrapper
  //                 })

  //                 decos.push(deco)
  //               }
  //             })

  //             /* 
  //             state.doc.descendants((node: ProseMirrorNode, pos: number) => {


  //               // block comment decoration
  //               if (node.type.name === inlineTagName || node.type.name === blockTagName) {
  //                 const deco = Decoration.widget(pos + 1, () => {
  //                   // wrapper for both caret + label
  //                   const wrapper = document.createElement('span')
  //                   wrapper.classList.add(
  //                     'secured-content-wrapper',
  //                     'relative',
  //                     // 'inline-flex',
  //                     // 'group'
  //                   )

  //                   // caret
  //                   // const caretEl = document.createElement('span')
  //                   // caretEl.className = 'secured-content-caret'
  //                   // wrapper.appendChild(caretEl)

  //                   // mount Svelte component here instead of labelEl
  //                   // const labelContainer = document.createElement('span')
  //                   // labelContainer.className = 'secured-content-caret-label'

  //                   // wrapper.appendChild(labelContainer)

  //                   new CustomSecuredContentExtensionWidget({
  //                     target: wrapper,
  //                     // target: labelContainer,
  //                     props: {
  //                       __author: node.attrs.author || 'Unknown',
  //                       __text: node.attrs.value || '',
  //                       __onUncomment: () => {
  //                         // call the command here
  //                         this.editor.commands.unsetSecuredContent(pos)
  //                       }
  //                     }
  //                   })

  //                   // label
  //                   /* const labelEl = document.createElement('span')
  //                   labelEl.className = 'secured-content-caret-label'
  //                   labelEl.textContent = `💬 ${node.attrs.value}`
  //                   wrapper.appendChild(labelEl)

  //                   // label (author name)
  //                   // const labelEl = document.createElement('span')
  //                   // labelEl.className = 'secured-content-caret-label'
  //                   // labelEl.textContent = `💬 ${node.attrs.author || 'Unknown'}`
  //                   // wrapper.appendChild(labelEl)

  //                   // main content (the comment text itself, optional)
  //                   // if (node.attrs.value) {
  //                   if (node.attrs.author) {
  //                     const authorEl = document.createElement('span')
  //                     authorEl.className = 'secured-content-caret-author'
  //                     authorEl.textContent = node.attrs.author
  //                     wrapper.appendChild(authorEl)
  //                   }

  //                   // uncomment button
  //                   const button = document.createElement('button')
  //                   button.className = 'secured-content-caret-button uncomment'
  //                   button.textContent = 'Uncomment'
  //                   // button.style.width = '100%'
  //                   button.onclick = (e) => {
  //                     e.preventDefault()
  //                     e.stopPropagation()
  //                     // Call your tiptap command
  //                     this.editor.commands.unsetSecuredContent(pos)
  //                   }
  //                   wrapper.appendChild(button) +/

  //                   return wrapper
  //                 })
  //                 /* const caret = Decoration.widget(pos + 1, () => {
  //                   const caretEl = document.createElement('span')
  //                   caretEl.className = 'secured-content-caret'
  //                   // caretEl.style.borderLeft = `2px solid ${this.options.caretColor}`
  //                   // caretEl.style.height = '1em'
  //                   // caretEl.style.display = 'inline-block'
  //                   // caretEl.style.pointerEvents = 'none'
  //                   return caretEl
  //                 })
  //                 const label = Decoration.widget(pos + 1, () => {
  //                   const el = document.createElement('span')
  //                   el.className = 'secured-content-caret-label'
  //                   el.textContent = `💬 ${node.attrs.value}`
  //                   // el.style.background = this.options.caretColor
  //                   // el.style.color = '#fff'
  //                   // el.style.fontSize = '0.75em'
  //                   // el.style.padding = '0 4px'
  //                   // el.style.borderRadius = '4px'
  //                   // el.style.marginLeft = '2px'
  //                   return el
  //                 })
  //                 decos.push(caret, label) +/
  //                 /* decos.push(
  //                   deco,
  //                   createWidgetDecoration(pos, {
  //                     author: 'comment.author',
  //                     text: 'comment.text',
  //                     onUncomment: () => {
  //                       console.log('Uncomment clicked', 'comment')
  //                       // trigger your removal logic here
  //                     }
  //                   })
  //                 ) +/
  //                 decos.push(deco)
  //               }
  //             })
  //  */

  //             return DecorationSet.create(state.doc, decos)
  //           }
  //         }
  //       })
  //     ]
  //   }
})

/* export const CustomSecuredContentExtensionCommentMark = Node.create({
  name: inlineTagName,
  inline: true,
  atom: true,
  selectable: true,
  group: 'inline',
  addAttributes() {
    // return { value: { default: '' } }
    return {
      value: { default: '' },
      marks: { default: [] }, // inline marks
      context: { default: [] }, // parent node info
      author: { default: null }
    }
  },
  // parseHTML: () => [{ tag: inlineTagName }],

  parseHTML() {
    return [{ tag: inlineTagName, getAttrs: (el) => ({ value: el.getAttribute('value') || '' }) }]
  },
  renderHTML({ node }) {
    return [
      inlineTagName,
      // { value: node.attrs.value, class: 'secured-content inline' }
      {
        value: node.attrs.value || '',
        marks: JSON.stringify(node.attrs.marks || []),
        context: JSON.stringify(node.attrs.context || []),
        author: node.attrs.author || '',
        class: 'secured-content inline'
      },
      0
    ]
  }
})

// Block node
export const CustomSecuredContentExtensionCommentNode = Node.create({
  name: blockTagName,
  group: 'block',
  atom: true,
  selectable: true,
  // content: 'inline*',
  addAttributes() {
    // return { value: { default: '' } }
    return {
      value: { default: '' },
      marks: { default: [] }, // inline marks
      context: { default: [] }, // parent node info
      author: { default: null }
    }
  },
  parseHTML() {
    return [{ tag: blockTagName, getAttrs: (el) => ({ value: el.getAttribute('value') || '' }) }]
  },
  renderHTML({ node }) {
    return [
      blockTagName,
      // { value: node.attrs.value, class: 'secured-content block' }
      {
        value: node.attrs.value,
        marks: JSON.stringify(node.attrs.marks),
        context: JSON.stringify(node.attrs.context),
        author: node.attrs.author || '',
        class: 'secured-content glass group'
        // class: 'secured-content glass group blur-md select-text'
        // class: 'secured-content block'
      },
      0
    ]
  }
}) */
