import { Extension } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const GhostWrite = Extension.create({
  name: 'ghostWrite',

  addStorage() {
    return {
      ghostText: '',
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('ghostWrite'),
        props: {
          decorations: (state) => {
            const { ghostText } = this.storage;
            if (!ghostText) return DecorationSet.empty;

            const { selection } = state;
            const decoration = Decoration.widget(selection.to, () => {
              const span = document.createElement('span');
              span.className = 'ghost-text-ai';
              span.style.color = '#a0a0b3';
              span.style.fontStyle = 'italic';
              span.style.opacity = '0.6';
              span.textContent = ghostText;
              return span;
            });
            return DecorationSet.create(state.doc, [decoration]);
          },
        },
      }),
    ];
  },
});