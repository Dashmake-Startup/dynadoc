import { Node, mergeAttributes } from '@tiptap/core'
import { CustomMeetingNoteTakingExtensionProps } from './utils/common.utils'
import { GenericCustomExtensionProps } from '../utils/common.utils'

export const CustomMeetingNoteTakingExtension = Node.create({
    name: CustomMeetingNoteTakingExtensionProps.name,
    group: 'block',
    content: 'inline*',
    // Use "atom" if you want to prevent users from typing inside the AI block 
    // until it is finalized, which reduces CRDT conflict calculations.
    atom: false,

    addAttributes() {
        return {
            [GenericCustomExtensionProps.tagAttributeId]: { default: null }, // Unique ID to target specific blocks
            [CustomMeetingNoteTakingExtensionProps.tagAttributeStatus]: {
                default: 'draft', // 'draft' | 'finalized'
                // parseHTML: element => element.getAttribute('data-status'),
                // renderHTML: attributes => ({ 'data-status': attributes.status }),
            },
            [CustomMeetingNoteTakingExtensionProps.tagAttributeSpeaker]: {
                default: 'AI',
            },
            [CustomMeetingNoteTakingExtensionProps.tagAttributeTimestamp]: {
                default: null,
                // parseHTML: element => element.getAttribute('data-time'),
                // renderHTML: attributes => {
                //     if (!attributes.timestamp) return {};
                //     return { 'data-time': attributes.timestamp };
                // },
            },
            [CustomMeetingNoteTakingExtensionProps.tagAttributeAnimate]: {
                default: false,
                // renderHTML: attributes => {
                //     if (attributes.animate !== 'true') return {};
                //     return { 'data-animate': 'true' };
                // }
            }
        }
    },

    //   parseHTML() {
    //     return [{ tag: 'div[data-type="transcription-block"]' }]
    //   },

    //   renderHTML({ HTMLAttributes }) {
    //     return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'transcription-block' }), 0]
    //   },

    parseHTML() {
        return [{ tag: CustomMeetingNoteTakingExtensionProps.tagName }]
    },

    renderHTML({ HTMLAttributes }) {
        return [CustomMeetingNoteTakingExtensionProps.tagName, mergeAttributes(HTMLAttributes),
            0 // <--- THIS ZERO IS THE CONTENT HOLE. DO NOT REMOVE.
        ]
    },
})

/* 

// In your Svelte Component
const worker = new TranscriptionWorker();

worker.onmessage = ({ data }) => {
  const { text, isFinal } = data;

  // DIRECT YJS UPDATE: This is significantly faster than editor.commands
  ydoc.transact(() => {
    const type = sharedRoot.get(sharedRoot.length - 1);
    
    if (type instanceof Y.XmlText && isStreamingToLastNode) {
      // Append text directly to the shared string
      type.insert(type.length, text);
    } else {
      // Create new Y.Xml elements only when necessary
      const newParagraph = new Y.XmlText(text);
      const newElement = new Y.XmlElement('transcriptionBlock');
      newElement.setAttribute('status', 'draft');
      newElement.insert(0, [newParagraph]);
      sharedRoot.insert(sharedRoot.length, [newElement]);
    }
  }, 'whisper-origin'); 
};
*/

/* 
// --- THE INNOVATION: SYNCING WHISPER AS A PEER ---
window.electron.on('whisper-chunk', (data) => {
  const { text, isFinal, timestamp } = data;

  // We wrap this in a Y.js transaction so it's treated as a single atomic update
  ydoc.transact(() => {
    const lastNode = editor.state.doc.lastChild;
    
    // Logic: If the last node is a draft transcription block, append to it.
    // Otherwise, create a new one.
    if (lastNode && lastNode.type.name === 'transcriptionBlock' && lastNode.attrs.status === 'draft') {
       const pos = editor.state.doc.content.size - 2; // Position inside the node
       editor.commands.insertContentAt(pos, text);
       
       if (isFinal) {
         editor.commands.updateAttributes('transcriptionBlock', { status: 'finalized' });
       }
    } else {
       editor.commands.insertContent({
         type: 'transcriptionBlock',
         attrs: { status: isFinal ? 'finalized' : 'draft' },
         content: [{ type: 'text', text }]
       });
    }
  }, 'whisper-server-agent'); // Origin label
});
*/