# TipTap Figures Extension

![demo](https://raw.githubusercontent.com/PentestPad/tiptap-extension-figure/refs/heads/main/demo.gif?raw=true)

An extension for Tiptap that allows you to add and edit captions for images as well as align and resize them.

[Tiptap](https://tiptap.dev/) is a suite of open source content editing and real-time collaboration tools for developers building apps like Notion or Google Docs.

## Installation

You can install it using npm:

```bash
npm install @pentestpad/tiptap-extension-figure
```

Keep in mind that this package requires Tiptap 2.x.

## Usage

```javascript
import StarterKit from "@tiptap/starter-kit";
import ImageResizeWithCaption from "@pentestpad/tiptap-extension-figure";
import { EditorContent, useEditor } from "@tiptap/react";

const editor = useEditor({
  extensions: [StarterKit, ImageResizeWithCaption],
  content: `
    <h3>Image with caption</h3>
    <figure>
        <img src="https://placehold.co/800x400/orange/white" alt="Random photo of something" title="Who's dat?">
        <figcaption>
        <p>Very <strong>bold</strong> of <i>you</i>!</p>
        </figcaption>
    </figure>

    <h3>Image without caption</h3>
    <img src="https://placehold.co/800x400/green/white">
  `,
});
```
