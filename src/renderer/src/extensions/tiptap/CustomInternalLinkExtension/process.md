To build a custom wiki-style internal linking feature in **Dynadoc**, you will want to implement a custom Tiptap **Mark extension** rather than a Node extension. Since a wiki link targets inline styled text (e.g., `[some text](file-uuid)`), a Mark is the cleanest semantic representation and prevents paragraph breaking or layout fracturing.

To match Dynadoc's style of architecture (clean decoupling, Svelte 5 contextual integration, and performance optimization via ProseMirror plugins), here is a complete step-by-step structural guide on how to design and build this.

---

### Step 1: Define the Mark Schema

Your extension will need structural attributes to hold the dynamic relationship information, specifically the target internal file ID (`fileId`) and optionally a caching label or type.

Create a new file called `CustomInternalLinkExtension.ts`:

```typescript
import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
  import { Mark, mergeAttributes, markInputRule } from '@tiptap/core';


export interface InternalLinkOptions {
  HTMLAttributes: Record<string, any>;
  onHoverIn?: (event: MouseEvent, fileId: string, view: any) => void;
  onHoverOut?: (event: MouseEvent) => void;
  onClick?: (event: MouseEvent, fileId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    CustomInternalLink: {
      setInternalLink: (attributes: { fileId: string }) => ReturnType;
      toggleInternalLink: (attributes: { fileId: string }) => ReturnType;
      unsetInternalLink: () => ReturnType;
    };
  }
}

export const CustomInternalLinkExtension = Mark.create<InternalLinkOptions>({
  name: ...,

  addOptions() {
    return {
      HTMLAttributes: {
        class: ...,
      },
    };
  },

  addAttributes() {
    return {
      fileId: {
        default: null,
        parseHTML: element => element.getAttribute('data-file-id'),
        renderHTML: attributes => {
          if (!attributes.fileId) return {};
          return { 'data-file-id': attributes.fileId };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: ... }];
  },

  renderHTML({ HTMLAttributes }) {
    return [tag, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setInternalLink: attributes => ({ chain }) => {
        return chain().setMark(this.name, attributes).run();
      },
      toggleInternalLink: attributes => ({ chain }) => {
        return chain().toggleMark(this.name, attributes).run();
      },
      unsetInternalLink: () => ({ chain }) => {
        return chain().unsetMark(this.name).run();
      },
    };
  },


// Inside your Mark.create({...}) framework configuration:
addInputRules() {
  return [
    markInputRule({
      // Matches the syntax [[File Name]]
      find: /\[\[([\w\s\-]+)\|?([\w\s\-]*)]\]$/,
      type: this.type,
      getAttributes: (match) => {
        // Trigger your Dynadoc file-picker modal UI here asynchronously
        // and return the permanent internal UUID to link structural metadata
        return {
          fileId: 'pending-selection-or-active-lookup-id',
        };
      },
    }),
  ];
}

});

```

---

### Step 2: Handle Hover, Popup, and Tab Clicks via a ProseMirror Plugin

Instead of injecting heavy raw inline event listeners inside `renderHTML` (which triggers excessive redraw calculations), add an isolated `ProseMirror Plugin` via the `addProseMirrorPlugins` method inside your extension.

This plugin captures global interaction bubbles at the view surface layer and maps target coordinates perfectly for your preview window layout.

```typescript
// Add this inside Mark.create({...}) under CustomInternalLinkExtension

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('CustomInternalLinkExtensionEvents'),
        props: {
          handleDOMEvents: {
            mouseover: (view, event) => {
              const target = event.target as HTMLElement;
              const linkEl = target.closest(tagName);
              if (linkEl && this.options.onHoverIn) {
                const fileId = linkEl.getAttribute(attrFile);
                if (fileId) {
                  this.options.onHoverIn(event, fileId, view);
                }
              }
            },
            mouseout: (view, event) => {
              if (this.options.onHoverOut) {
                this.options.onHoverOut(event);
              }
            },
            click: (view, event) => {
              const target = event.target as HTMLElement;
              const linkEl = target.closest(tagName);
              if (linkEl) {
                event.preventDefault();
                event.stopPropagation();
                const fileId = linkEl.getAttribute(attrFile);
                if (fileId && this.options.onClick) {
                  this.options.onClick(event, fileId);
                }
                return true;
              }
              return false;
            }
          }
        }
      })
    ];
  }

```

---

### Step 3: Global Preview Store & Svelte 5 Popup UI

Following your existing design patterns using global transient controllers (like `tableExcelView.store`), create a state engine for the wiki popups. This isolates your DOM layer from editor state recalculations.

Create `internalLink.store.ts`:

```typescript
import { writable } from 'svelte/store'; // Or use reactive Svelte 5 state variables depending on preference

export interface InternalLinkPreviewState {
  visible: boolean;
  fileId: string | null;
  x: number;
  y: number;
}

export const internalLinkStore = writable<InternalLinkPreviewState>({
  visible: false,
  fileId: null,
  x: 0,
  y: 0,
});

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const showPreview = (fileId: string, x: number, y: number) => {
  if (hideTimer) clearTimeout(hideTimer);
  internalLinkStore.set({ visible: true, fileId, x, y: y + 15 }); // slight pixel offset below text
};

export const delayHidePreview = () => {
  hideTimer = setTimeout(() => {
    internalLinkStore.update(s => ({ ...s, visible: false }));
  }, 300); // short grace window to let user move mouse into preview box
};

export const cancelHidePreview = () => {
  if (hideTimer) clearTimeout(hideTimer);
};

```

Create the presentation component using **Svelte 5 runes syntax**, mirroring your application structure:

```svelte
<script lang="ts">
  import { internalLinkStore, delayHidePreview, cancelHidePreview } from './internalLink.store';
  import { onDestroy } from 'svelte';

  let state = $state({ visible: false, fileId: null, x: 0, y: 0 });
  
  const unsubscribe = internalLinkStore.subscribe(value => {
    state = value;
  });

  // Mock document fetching logic : use the file path to create a new /path/to/dynadoc/src/renderer/src/components/app/editor/wysiwyg/WysiwygEditor.svelte and display the content
  let previewContent = $derived.by(() => {
    if (!state.fileId) return { title: '', snippet: '' };
    // replace this with real document fetching logic 
    return {
      title: `Document ID: ${state.fileId.slice(0, 8)}...`,
      snippet: 'Loading real-time snapshot content from workspace data indexes...'
    };
  });

  onDestroy(unsubscribe);
</script>

{#if state.visible}
  <div 
    class="wiki-popup"
    style="left: {state.x}px; top: {state.y}px;"
    onmouseenter={cancelHidePreview}
    onmouseleave={delayHidePreview}
    role="tooltip"
  >
    <div class="popup-header">
      <i class="ph-light ph-file-text"></i>
      <h4>{previewContent.title}</h4>
    </div>
    <div class="popup-body">
      <p>{previewContent.snippet}</p>
    </div>
    <div class="popup-footer">
      <span>Click to open in a workspace tab</span>
    </div>
  </div>
{/if}

<style>
  .wiki-popup {
    position: fixed;
    z-index: 10080;
    width: 280px;
    background: #1b1b1b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    padding: 12px;
    color: #e7e7e7;
    pointer-events: auto;
  }
  .popup-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: bold;
    color: #66f0e0;
    margin-bottom: 6px;
    font-size: 13px;
  }
  .popup-body {
    font-size: 11px;
    color: #b5b5b5;
    line-height: 1.4;
    margin-bottom: 8px;
  }
  .popup-footer {
    font-size: 9px;
    color: rgba(255,255,255,0.3);
    text-align: right;
  }
</style>

```

---

### Step 4: Wire it into your Editor Core Instance

Now mount the `InternalLinkPreviewPopup.svelte` somewhere layout-stable at your workspace core container layout root. Then register the Extension to your Tiptap initialization chain, routing your execution parameters straight into your UI management logic:

```typescript
import { CustomInternalLinkExtension } from './CustomInternalLinkExtension';
import { showPreview, delayHidePreview } from './internalLinkPreview.store';

const editor = new Editor({
  extensions: [
    // ...other core extensions
    CustomInternalLinkExtension.configure({
      onHoverIn: (event, fileId) => {
        showPreview(fileId, event.clientX, event.clientY);
      },
      onHoverOut: () => {
        delayHidePreview();
      },
      onClick: (event, fileId) => {
        // App workspace architecture handles context tabs
        if (window.dynadocApp?.openFileInNewTab) {
          window.dynadocApp.openFileInNewTab(fileId);
        } else {
          // Fallback or debug
          console.log(`Opening file: ${fileId} in a new tab instance context.`);
        }
      }
    })
  ]
});

```

### Step 5: Adding Toolbar Actions (Insert, Edit, Remove)

To manipulate these wiki links directly from your top ribbon menu bar or floating action menus, invoke the extension's commands bound directly to user selections:

* **Insert/Edit Link:**
```typescript
// Prompts user for a target file selection context or uses a quick lookup popup
const targetFileId = "some-internal-uuid-value"; 
editor.chain().focus().setInternalLink({ fileId: targetFileId }).run();

```


* **Remove Link:**
```typescript
editor.chain().focus().unsetInternalLink().run();

```


* **Checking Selection State (for active UI indicators):**
```typescript
const isInternalLinkActive = editor.isActive('CustomInternalLink');
const activeFileId = editor.getAttributes('CustomInternalLink').fileId;

```



This architectural setup perfectly maintains decoupling, protects execution speeds, provides strict tab-routing guarantees, and works seamlessly with standard formatting operations without dirtying underlying structural schemas.