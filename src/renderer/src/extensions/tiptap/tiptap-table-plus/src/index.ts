import PaginationTable from "./pagination";
import { TablePlus } from "./TablePlus";

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
      tableCommandExtension: {
        duplicateColumn: (withContent?: boolean) => ReturnType;
        duplicateRow: (withContent?: boolean) => ReturnType;
      };
    }
  }
  
export { PaginationTable, TablePlus };
