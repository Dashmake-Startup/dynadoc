// export type ContextMenuItem = {
//     icon?: string
//     label: string
//     shortcut?: string
//     group?: number
//     active?: boolean
//     submenu?: boolean
//     action?: () => void
// }

export interface ContextMenuItem {
  label: string;
  icon?: string;
  iconHtml?: string;
  action?: () => void;
  shortcut?: string;
  group?: number;
  inline?: boolean;
  active?: boolean;
  disabled?: boolean;
  description?: string;
  tooltip?: string;
  children?: ContextMenuItem[]; // For submenus
}
