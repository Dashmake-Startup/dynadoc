# Tiptap Extensions

Dynadoc extends the Tiptap 3 / ProseMirror editor with **17+ custom extensions** located in `src/renderer/src/extensions/tiptap/`.

## Extension List

| Extension | Purpose |
|---|---|
| `CustomAIExtension` | In-document AI content generation (Ollama + cloud) |
| `CustomSlideExtension` | Slide/presentation management within documents |
| `CustomSpreadsheetExtension` | Embedded Fortune-Sheet spreadsheets |
| `CustomTranslationExtension` | Side-by-side translation with locale detection |
| `CustomVarExtension` | Dynamic variables synced across documents |
| `CustomFormFieldExtension` | Interactive form fields (text, checkbox, radio, buttons) |
| `CustomReviewExtension` | Track changes / suggestion mode |
| `CustomCodeBlockExtension` | Monaco-powered code blocks |
| `CustomImageExtension` | Advanced image handling (resize, crop, filters) |
| `CustomTableExtension` | Enhanced table editing |
| `CustomChartExtension` | Data visualization charts |
| `CustomMathExtension` | LaTeX math rendering |
| `CustomEmojiExtension` | Emoji picker and rendering |
| `CustomMentionExtension` | @mentions for users and documents |
| `CustomProtectionExtension` | Paragraph/section-level content protection |
| `CustomEphemeralExtension` | Self-destruct content (by date, read count, write count) |
| `CustomDesignExtension` | Embedded Konva design canvas |

## How Extensions Work

Each extension follows the Tiptap 3 extension pattern:

```
extensions/tiptap/CustomXxxExtension/
├── index.ts          # Extension registration (Node/Mark definition)
├── Component.svelte  # Svelte 5 NodeView component
├── commands.ts       # Editor commands (optional)
├── helpers.ts        # Utility functions (optional)
└── types.ts          # TypeScript types (optional)
```

Extensions register as either:
- **Node extensions**: Block-level content (spreadsheets, slides, forms)
- **Mark extensions**: Inline formatting (variables, protection markers)

## Key Extension Details

### CustomAIExtension

Provides AI-powered content generation directly in the editor:
- Inline AI completion (cursor-position aware)
- Content transformation (rewrite, translate, summarize)
- Image generation via AI
- Connects to Ollama (local) or cloud AI via the middleware

### CustomVarExtension

Enables dynamic variables that stay synchronized:
- Text variables (company name, project title)
- File variables (embedded documents)
- Rich content variables (formatted blocks)
- AI-generated variables (computed on demand)
- Changes to a variable update all instances across documents

### CustomSlideExtension

Turns document sections into presentation slides:
- Horizontal and vertical slide navigation
- Animations and transitions
- Presenter mode with speaker notes
- Export individual slides as images

### CustomFormFieldExtension

Embeds interactive form fields in documents:
- Text input, textarea
- Checkbox, radio buttons
- Dropdown selects
- Action buttons
- Form submissions tracked via `POST /forms/submit`

### CustomReviewExtension

Word-style document review:
- Track insertions and deletions
- Inline comments with threads
- Accept/reject individual changes
- Suggestion mode toggle

## Adding a New Extension

1. Create a directory under `src/renderer/src/extensions/tiptap/`
2. Define the Node or Mark in `index.ts`
3. Create the Svelte 5 NodeView component
4. Register the extension in the editor configuration
5. Add any necessary store state in `src/renderer/src/stores/`
