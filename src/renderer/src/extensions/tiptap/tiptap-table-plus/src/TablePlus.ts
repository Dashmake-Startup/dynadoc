import { Table as TiptapTable } from '@tiptap/extension-table'
// import TiptapTable from '@tiptap/extension-table'
import { Table } from '@tiptap/extension-table'
import TableCommandExtension from './TableCommandExtension';

export const TablePlus = TiptapTable.extend({
    addExtensions() {
        return [
            TableCommandExtension
        ]
    }
})

export default TablePlus
