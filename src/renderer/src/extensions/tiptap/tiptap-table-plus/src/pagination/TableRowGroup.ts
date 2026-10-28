import { Node } from "@tiptap/core";
import { DOMOutputSpec } from "@tiptap/pm/model";
import { Slice } from "prosemirror-model"

import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";

export const TableRowGroup = Node.create({
  name: "tableRowGroup",
  group: "tableRowGroup",
  content: "tableRow+",
  tableRole: "table",
  parseHTML() {
    return [
      {
        tag: "tbody",
      },
    ];
  },
  
  addNodeView() {
    // return null
    return ({ node }) => {
      // return ['div', {}, 0] 
      const dom = document.createElement("div");
      dom.classList.add("table-row-group");
      const tbody = document.createElement("tbody");
      dom.appendChild(tbody);
      return { dom, contentDOM: tbody };
    };
  },
  renderHTML() {
    //  return ['div', {}, 0] 
    const table: DOMOutputSpec = ["tbody", {}, 0];
    return table;
  },

  addProseMirrorPlugins() {
    const { editor } = this;
    return [
      new Plugin({
        key: new PluginKey("tableRowGroupKey"),
        appendTransaction(_, oldState, newState) {
          const { doc, tr } = newState;

          let modified = false;

          doc.descendants((tableNode, pos) => {
            if (tableNode.type.name !== "table") return false;

            const rowGroups: ProseMirrorNode[] = [];
            const rows: ProseMirrorNode[] = [];
            const oldRowGroupStructure: Record<number, number> = {};

            // Collect all rows, whether they're direct children or inside row groups
            tableNode.forEach((child, childOffset, childIndex) => {
              if (child.type.name === "tableRowGroup") {
                oldRowGroupStructure[childIndex] = child.childCount;
                child.forEach((row) => {
                  if (row.type.name === "tableRow") {
                    rows.push(row);
                  }
                });
              } else if (child.type.name === "tableRow") {
                oldRowGroupStructure[childIndex] = 1;
                rows.push(child);
              }
            });

            // Group the rows into tableRowGroup with rowspan logic
            let rowSpanList: Record<number, number> = {};
            for (let i = 0; i < rows.length; i++) {
              rowSpanList[i + 1] = getMaximumRowSpan(rows[i]);
            }
            const rowGroupList = mergeOverlappingGroups(
              getRowGroupList(rows.length, rowSpanList)
            );
            const newRowGroupStructure: Record<number, number> = Object.assign(
              {},
              rowGroupList.map((group) => group.length)
            );

            if (!deepMatch(oldRowGroupStructure, newRowGroupStructure)) {
              const nodeType = editor.schema.nodes.tableRowGroup;
              const rowGroupMoreThanOne = rowGroupList.findIndex(
                (group) => group.length > 1
              );
              for (let i = 0; i < rowGroupList.length; i++) {
                const rowGroup = rows.slice(
                  Math.min(...rowGroupList[i]) - 1,
                  Math.max(...rowGroupList[i])
                );
                if (rowGroup.length > 0) {
                  if (rowGroupMoreThanOne !== -1) {
                    rowGroups.push(
                      nodeType.createAndFill(null, rowGroup) as ProseMirrorNode
                    );
                  } else {
                    rowGroups.push(rowGroup[0] as ProseMirrorNode);
                  }
                }
              }
              const tableNodeType = editor.schema.nodes.table;

              /* Custom code - Lines Commented because of bug, creating table with empty rows in case of multiple table */
              /* const tableNodeNew = tableNodeType.createAndFill(
                null,
                rowGroups
              ) as ProseMirrorNode;
              tr.replaceWith(pos, pos + tableNode.nodeSize, tableNodeNew); */
              /* Custom code - Solution to the aove issue */
              const tableNodeNew = tableNodeType.create(tableNode.attrs, rowGroups);
              if (tableNodeNew) {
                const slice = new Slice(tableNodeNew.content, 0, 0)
                tr.replace(pos, pos + tableNode.nodeSize, slice)
              }

              modified = true;
            }

            return false; // Do not descend into table children
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});

export const getMaximumRowSpan = (row: ProseMirrorNode) => {
  let maxRowSpan = 0;
  row.forEach((child) => {
    const rowspan = child.attrs.rowspan || 1;
    if (rowspan > maxRowSpan) {
      maxRowSpan = rowspan;
    }
  });
  return maxRowSpan;
};

function deepMatch(obj1: Record<number, number>, obj2: Record<number, number>) {
  if (
    typeof obj1 !== "object" ||
    obj1 === null ||
    typeof obj2 !== "object" ||
    obj2 === null
  ) {
    return obj1 === obj2;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (let key of keys1) {
    // @ts-ignore
    if (!obj2.hasOwnProperty(key) || !deepMatch(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}

export const getRowGroupList = (
  totalRows: number,
  rowSpanList: Record<number, number>
) => {
  const rowGroupListWithRowCount = [];

  for (let i = 1; i <= totalRows; i++) {
    const span = rowSpanList[i] || 1;
    const group = [];

    for (let j = 0; j < span && i + j <= totalRows; j++) {
      group.push(i + j);
    }

    rowGroupListWithRowCount.push(group);
  }

  return rowGroupListWithRowCount;
};

export const mergeOverlappingGroups = (inputGroups: number[][]): number[][] => {
  const result: number[][] = [];

  for (const group of inputGroups) {
    let merged = false;
    const groupSet = new Set(group);

    for (let i = 0; i < result.length; i++) {
      const existingSet = new Set(result[i]);
      const intersection = Array.from(groupSet).some((val) =>
        existingSet.has(val)
      );

      if (intersection) {
        // Merge and update
        result[i] = Array.from(new Set([...result[i], ...group]));
        merged = true;
        break;
      }
    }

    if (!merged) {
      result.push([...group]);
    }
  }

  // Recursively merge in case earlier merges caused new overlaps
  const allSets = result.map((g) => new Set(g));
  for (let i = 0; i < allSets.length; i++) {
    for (let j = i + 1; j < allSets.length; j++) {
      const overlap = Array.from(allSets[i]).some((val) => allSets[j].has(val));
      if (overlap) {
        // Merge and restart process
        return mergeOverlappingGroups(result.map((g) => [...g]));
      }
    }
  }

  // Sort each group
  return result.map((g) => Array.from(new Set(g)).sort((a, b) => a - b));
};
