import { TableOptions } from "@tiptap/extension-table";

export interface TablePlusOptions extends TableOptions {
    resizeHandleStyle?: Partial<CSSStyleDeclaration>;
    minColumnSize?: number;
    borderColor?: string;
}