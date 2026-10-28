
import LayoutButton from './LayoutButton.svelte'
import LayoutButtonPicker from './LayoutButtonPicker.svelte'
import LayoutColumn from './LayoutColumn.svelte'
import LayoutIcon from './LayoutIcon.svelte'
import LayoutRow from './LayoutRow.svelte'
import LayoutSelect from './LayoutSelect.svelte'
// export const Layout = {"column" | "row" | "select" | "icon"}
export class Layout {
  static LAYOUT = Object.freeze({
    COLUMN: 'column',
    ROW: 'row',
    SELECT: 'select',
    BUTTON_PICKER: 'button-picker',
    BUTTON: 'button',
    ICON: 'icon',
  })
  static DIRECTION = Object.freeze({
    HORIZONTAL: 'horizontal',
    VERTICAL: 'vertical',
  })

  static LAYOUT_COMPONENTS = {
    [Layout.LAYOUT.COLUMN]: LayoutColumn,
    [Layout.LAYOUT.ROW]: LayoutRow,
    [Layout.LAYOUT.SELECT]: LayoutSelect,
    [Layout.LAYOUT.ICON]: LayoutIcon,
    [Layout.LAYOUT.BUTTON_PICKER]: LayoutButtonPicker,
    [Layout.LAYOUT.BUTTON]: LayoutButton
  }

}

export default Layout

