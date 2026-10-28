# TipTap Pagination Plus
[![NPM](https://img.shields.io/npm/v/tiptap-pagination-plus.svg)](https://www.npmjs.com/package/tiptap-pagination-plus)

A TipTap extension that adds pagination support to your editor with table handling capabilities.

## Installation

```bash
npm install tiptap-pagination-plus
```

## Usage

### Basic Setup

```typescript
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { 
  PaginationPlus,
  TablePlus,
  TableRowPlus,
  TableCellPlus,
  TableHeaderPlus
} from 'tiptap-pagination-plus'

const editor = new Editor({
  extensions: [
    StarterKit,
    TablePlus,
    TableRowPlus,
    TableCellPlus,
    TableHeaderPlus,
    PaginationPlus.configure({
      pageHeight: 842,        // Height of each page in pixels
      pageGap: 20,           // Gap between pages in pixels
      pageBreakBackground: "#f7f7f7",  // Background color for page gaps
      pageHeaderHeight: 50,   // Height of page header/footer in pixels
      footerText: "Made with ❤️ by Romik"  // Custom footer text
    }),
  ],
})
```

### Table Pagination

Key points for table pagination:
- Tables will automatically split across pages when they exceed the page height
- To split table across pages, you have to use these extensions
- List : TablePlus, TableRowPlus, TableCellPlus, TableHeaderPlus

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pageHeight` | number | 842 | Height of each page in pixels |
| `pageGap` | number | 20 | Gap between pages in pixels |
| `pageBreakBackground` | string | "#f7f7f7" | Background color for page gaps |
| `pageHeaderHeight` | number | 50 | Height of page header/footer in pixels |
| `footerText` | string | "" | Custom text to display in the footer of each page |

### Features

- Automatic page breaks based on content height
- Page numbers in the footer
- Custom footer text support
- Table pagination with header preservation
- Responsive design
- Automatic page height calculation
- Support for nested content

## License

MIT
