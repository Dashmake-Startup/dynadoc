"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Code,
  Table as TableIcon,
  Trash2,
  Heading1,
  Heading2,
  Github,
} from "lucide-react";
import ListItem from "@tiptap/extension-list-item";
import {
  PaginationPlus,
  TableCellPlus,
  TableHeaderPlus,
  TablePlus,
  TableRowPlus,
} from "tiptap-pagination-plus";
import { Button } from "./button";
import { editorContent } from "@/lib/editor-content";
const TiptapEditor = () => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TablePlus,
      TableRowPlus,
      TableCellPlus,
      TableHeaderPlus,
      ListItem,
      PaginationPlus.configure({
        pageHeight: 842,
        pageGap: 20,
        pageBreakBackground: "hsl(var(--background))",
        pageHeaderHeight: 50,
        footerRight: "Made with ❤️ by Romik",
        footerLeft: "Page {page}",
        headerLeft: "Header Left",
        headerRight: "Header Right",
      }),
    ],
    // content: editorContentLong,
    content: editorContent,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[200px] px-10",
      },
    },
    onUpdate: ({ editor }) => {
      console.log(editor.getJSON());
    },
  });

  if (!editor) {
    return null;
  }

  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 4, withHeaderRow: true })
      .run();
  };

  const addColumnBefore = () => {
    editor.chain().focus().addColumnBefore().run();
  };

  const addColumnAfter = () => {
    editor.chain().focus().addColumnAfter().run();
  };

  const addRowBefore = () => {
    editor.chain().focus().addRowBefore().run();
  };

  const addRowAfter = () => {
    editor.chain().focus().addRowAfter().run();
  };

  const deleteTable = () => {
    editor.chain().focus().deleteTable().run();
  };

  return (
    <div className="">
      <div className="sticky top-0 z-[10] pt-8">
        <div className="w-full mb-1 flex flex-row gap-2 justify-between">
          <div className="inline-flex flex-row gap-2">
          <a
            href="https://github.com/RomikMakavana/tiptap-pagination"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm" className="!bg-black">
              <Github className="h-4 w-4 text-base-content" />
            </Button>
          </a>
          <iframe src="https://github.com/sponsors/RomikMakavana/button" title="Sponsor RomikMakavana" height="32" width="114" style={{border: '0', borderRadius: '6px'}}></iframe>
          </div>
          <a
            href="https://www.buymeacoffee.com/romikmakavana"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt="Buy Me A Coffee"
              style={{ height: "35px", width: "132px" }}
            />
          </a>

        </div>
        <div className="border rounded-lg shadow-sm p-2 bg-muted/90 flex flex-wrap gap-1 backdrop-blur-md">
          <div className="flex flex-wrap gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo className="h-4 w-4" />
            </Button>

            {/* Table Controls */}
            <div className="border-l mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              className={
                editor.isActive("heading", { level: 1 }) ? "bg-muted" : ""
              }
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              className={
                editor.isActive("heading", { level: 2 }) ? "bg-muted" : ""
              }
            >
              <Heading2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="border-l mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "bg-muted" : ""}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "bg-muted" : ""}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive("underline") ? "bg-muted" : ""}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive("strike") ? "bg-muted" : ""}
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={editor.isActive("code") ? "bg-muted" : ""}
          >
            <Code className="h-4 w-4" />
          </Button>
          <div className="border-l mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive("bulletList") ? "bg-muted" : ""}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive("orderedList") ? "bg-muted" : ""}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <div className="border-l mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive("blockquote") ? "bg-muted" : ""}
          >
            <Quote className="h-4 w-4" />
          </Button>
          <div className="border-l mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={insertTable}
            className={editor.isActive("table") ? "bg-muted" : ""}
          >
            <TableIcon className="h-4 w-4" />
          </Button>
          {editor.isActive("table") && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={addColumnBefore}
                className="text-xs"
              >
                ←Col
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={addColumnAfter}
                className="text-xs"
              >
                Col→
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={addRowBefore}
                className="text-xs"
              >
                ↑Row
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={addRowAfter}
                className="text-xs"
              >
                Row↓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteTable}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="">
        <EditorContent
          editor={editor}
          className="w-full border mb-5 mt-2"
          id="editor"
        />
        {/* <TiptapPageWrapper>
        </TiptapPageWrapper> */}
      </div>
    </div>
  );
};

export default TiptapEditor;
