import { rowIsHeader, tableNodeTypes } from "@tiptap/pm/tables";
import { Transaction } from "@tiptap/pm/state";

/**
 * Adds a duplicate row to the table in the ProseMirror transaction.
 * 
 * @param {Transaction} tr - The ProseMirror transaction.
 * @param {Object} tableInfo - Information about the table (map, tableStart, table).
 * @param {number} row - The index of the row to duplicate.
 * @param {boolean} withContent - Whether to duplicate the content of the row.
 * @returns {Transaction} - The updated transaction.
 */
export default function addDuplicateRow(
    tr: Transaction,
    { map, tableStart, table }: { map: any, tableStart: number, table: any },
    row: number,
    withContent = true
) {
    // Calculate the starting position of the row to duplicate
    let rowPos = tableStart;
    for (let i = 0; i < row; i++) rowPos += table.child(i).nodeSize;

    const cells = []; // Array to hold the new cells for the duplicated row
    let refRow = row > 0 ? -1 : 0; // Reference row for copying content

    // Check if the reference row is a header row
    // if (rowIsHeader(map, table, row + refRow))
    //     refRow = row == 0 || row == map.height ? null : 0;

    // Iterate through each column in the row

    
    for (let col = 0, index = map.width * row; col < map.width; col++, index++) {
        // Handle cells covered by a rowspan
        if (
            row > 0 &&
            row < map.height &&
            map.map[index] == map.map[index - map.width]
        ) {
            const pos = map.map[index]; // Position of the cell
            const attrs = table.nodeAt(pos).attrs; // Attributes of the cell

            // Update the rowspan attribute to include the new row
            tr.setNodeMarkup(tableStart + pos, null, {
                ...attrs,
                rowspan: attrs.rowspan + 1,
            });

            // Skip columns covered by the colspan
            col += attrs.colspan - 1;
        } else {
            // Determine the reference cell for the current column
            const _refRow = !Array.isArray(map.map) || refRow == null || !((index + refRow * map.width) in map.map)
                ? null
                : table.nodeAt(map.map[index + refRow * map.width]);

            // Determine the type of the cell (header or regular)
            const type =
                refRow == null
                    ? tableNodeTypes(table.type.schema).cell
                    : table.nodeAt(map.map[index + refRow * map.width])?.type;

            // Create a new cell node, optionally copying content
            const node = _refRow !== null
                ? (withContent
                    ? type?.create({ ..._refRow.attrs }, _refRow.content)
                    : type?.createAndFill({ ..._refRow.attrs }))
                : type?.createAndFill();

            // Add the new cell to the cells array
            if (node) cells.push(node);
        }
    }

    // Insert the new row into the table
    tr.insert(rowPos, tableNodeTypes(table.type.schema).row.create(null, cells));
    return tr;
}