import { Extension } from '@tiptap/core'
import { getFakerByLocale } from './utils/utils'

export interface DummyContentOptions {
  locale?: string // ← ANY faker locale
  paragraphs?: number
  includeHeadings?: boolean
  includeTable?: boolean
  includeImages?: boolean
  imageCount?: number
  fillSelection?: boolean
  table?: {
    rows: number
    cols: number
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    CustomDummyContentExtension: {
      insertDummyContent: (attrs: {}) => ReturnType
    }
  }
}

export const CustomDummyContentExtension = Extension.create({
  name: 'dummyContent',

  addCommands() {
    return {
      insertDummyContent:
        (options: DummyContentOptions = {}) =>
          async ({ editor, chain, state }) => {
            console.log("insertDummyContent ent")

            // const {
            //   locale = 'en',
            //   paragraphs = 3,
            //   includeHeadings = true,
            //   includeTable = false,
            //   includeImages = false,
            //   imageCount = 1,
            //   fillSelection = false,
            //   table = { rows: 3, cols: 3 }
            // } = options
            const {
              locale = 'en',
              paragraphs = 30,
              includeHeadings = true,
              includeTable = false,
              // includeTable = true,
              includeImages = true,
              imageCount = 3,
              fillSelection = true,
              table = { rows: 5, cols: 7 }
            } = options

            console.log("insertDummyContent options", { options })
            //   const locale =
            //   options.locale ??
            //   detectLocale(state, editor.view.dom as HTMLElement)

            const faker = await getFakerByLocale(locale)
            const content: any[] = []

            // Heading
            if (includeHeadings) {
              content.push({
                type: 'heading',
                attrs: { level: 2 },
                content: [
                  {
                    type: 'text',
                    text: faker.lorem.sentence({ min: 3, max: 6 })
                  }
                ]
              })
            }

            // Paragraphs
            for (let i = 0; i < paragraphs; i++) {
              content.push({
                type: 'paragraph',
                content: [{ type: 'text', text: faker.lorem.paragraph() }]
              })
            }

            // Images
            if (includeImages) {
              for (let i = 0; i < imageCount; i++) {
                content.push({
                  type: 'img',
                  // type: 'image',
                  attrs: {
                    src: faker.image.urlPicsumPhotos({
                      width: 800,
                      height: 400
                    }),
                    alt: faker.lorem.words(3)
                  }
                })
              }
            }

            // Table
            if (includeTable) {
              content.push({
                type: 'table',
                content: Array.from({ length: table.rows }).map(() => ({
                  type: 'tableRow',
                  content: Array.from({ length: table.cols }).map(() => ({
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', text: faker.lorem.words({ min: 1, max: 3 }) }
                        ]
                      }
                    ]
                  }))
                }))
              })
            }

            const { from, to } = state.selection

            console.log("insertDummyContent yeah", { from, to, content, fillSelection })

            // Word-like fill selection
            if (fillSelection && from !== to) {
              console.log("insertDummyContent yeah dnter...", { from, to, content, fillSelection })

              // return
               editor
                .chain()
                .focus()
                .deleteRange({ from, to })
                .insertContentAt(from, content)
                .run()
            }

            // return
             editor
              .chain()
              .focus()
              .insertContentAt(from, content)
              .run()

              // editor.commands.updatePagination?.(true)
              // update pagination manually
              editor.commands.updatePagination?.()
              return true
            // return editor.chain().focus().insertContent(content).run()
          }
    }
  }
})
