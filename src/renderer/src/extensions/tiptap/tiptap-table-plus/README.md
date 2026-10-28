
# Tiptap Table Plus
[![NPM](https://img.shields.io/npm/v/tiptap-table-plus.svg)](https://www.npmjs.com/package/tiptap-table-plus)

`tiptap-table-plus` | Tiptap table plus is an npm package that extends the table functionality of the Tiptap editor by adding two new commands: `duplicateColumn` and `duplicateRow`.

Demo : https://romikmakavana.me/tiptap/table-plus/example

Documentation : https://romikmakavana.me/tiptap/table-plus


## Installation

To install the package, use npm:

```bash
npm install tiptap-table-plus
```

## Peer Dependencies

This package works with peer dependencies and requires the following packages to be installed in your project:

```bash
npm install @tiptap/extension-table @tiptap/extension-table-cell @tiptap/extension-table-header @tiptap/extension-table-row @tiptap/pm
```

**Note**: Make sure you have these peer dependencies installed as they are required for the package to function properly. The package will not work without these Tiptap extensions and ProseMirror.

# Without Pagination

| Command           | Parameters              | Default | Description                                                                                                 |
| ----------------- | ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `duplicateColumn` | `withContent` (boolean) | `true`  | Duplicates the current column. If `true`, copies column content; if `false`, only duplicates the structure. |
| `duplicateRow`    | `withContent` (boolean) | `true`  | Duplicates the current row. If `true`, copies row content; if `false`, only duplicates the structure.       |


### Example

Here is an example of how to use these commands in your Tiptap editor setup:
```js
import { Editor } from '@tiptap/core';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TiptapTablePlus from 'tiptap-table-plus';

const editor = new Editor({
  extensions: [
    TiptapTablePlus,
    TableRow,
    TableCell,
    TableHeader,
  ],
  content: '<table border="1"><tr><th colspan="1" rowspan="1"><p>Name</p></th><th colspan="1" rowspan="1"><p>Region</p></th><th colspan="1" rowspan="1"><p>Country</p></th></tr><tr><td colspan="1" rowspan="1"><p>Liberty Hays</p></td><td colspan="1" rowspan="1"><p>Araucanía</p></td><td colspan="1" rowspan="1"><p>Canada</p></td></tr></table>',
});
```

---------------
---------------
---------------

# Pagination Table Support

The package now includes advanced pagination table support with automatic row grouping based on rowspan logic. This feature automatically organizes table rows into logical groups for better pagination and display.

Tiptap Pagination : https://romikmakavana.me/tiptap/pagination-plus/

## Features

- **Automatic Row Grouping**: Intelligently groups table rows based on rowspan attributes
- **Enhanced Table Structure**: Supports both direct table rows and grouped table rows
- **Smart Pagination**: Automatically handles complex table layouts with merged cells
- **CSS Custom Properties**: Provides CSS variables for styling and layout control
- **Column Resize Support** – Allows users to interactively adjust column widths for better readability
## Components

### `PaginationTable`
A comprehensive extension that includes all pagination table components:

```js
import { PaginationTable } from 'tiptap-table-plus';
```

## Usage with Pagination

Here's how to set up the pagination table extension:

```js
import { Editor } from '@tiptap/core';
import { PaginationTable } from 'tiptap-table-plus';
import { PaginationPlus } from "tiptap-pagination-plus";

const { TablePlus, TableRowPlus, TableCellPlus, TableHeaderPlus } = PaginationTable;

const editor = new Editor({
  extensions: [
    TablePlus,
    TableRowPlus,
    TableCellPlus,
    TableHeaderPlus,
    PaginationPlus
  ],
  content: '<table border="1"><tr><th colspan="1" rowspan="1"><p>Name</p></th><th colspan="1" rowspan="1"><p>Region</p></th><th colspan="1" rowspan="1"><p>Country</p></th></tr><tr><td colspan="1" rowspan="1"><p>Liberty Hays</p></td><td colspan="1" rowspan="1"><p>Araucanía</p></td><td colspan="1" rowspan="1"><p>Canada</p></td></tr></table>',
});
```

## How It Works

The pagination system automatically:

1. **Analyzes Table Structure**: Examines rowspan attributes and table layout
2. **Groups Related Rows**: Creates logical groups based on merged cells
3. **Optimizes Pagination**: Ensures related content stays together across page breaks
4. **Maintains Consistency**: Automatically updates grouping when table structure changes


# License
This package is open-sourced software licensed under the MIT license.

