import { html, nothing, TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { customElement, VscElement } from '../includes/VscElement.js';
import type { VscodeContextMenuItem } from '../vscode-context-menu-item/vscode-context-menu-item.js';
import '../vscode-context-menu-item/index.js';
import styles from './vscode-context-menu.styles.js';

interface MenuItemData {
  label?: string;
  icon?: string;
  keybinding?: string;
  value?: string;
  separator?: boolean;
  tabindex?: number;
  itemChildren?: string;
  // itemChildren?: Array<any>;
}

export type VscContextMenuSelectEvent = CustomEvent<{
  keybinding: string;
  icon: string;
  label: string;
  value: string;
  separator: boolean;
  tabindex: number;
  itemChildren?: string;
  // itemChildren?: Array<any>;
}>;

/**
 * @tag vscode-context-menu
 *
 * @fires {VscMenuSelectEvent} vsc-menu-select - Emitted when a menu item is clicked
 *
 * @cssprop [--vscode-font-family=sans-serif]
 * @cssprop [--vscode-font-size=13px]
 * @cssprop [--vscode-font-weight=normal]
 * @cssprop [--vscode-menu-background=#1f1f1f]
 * @cssprop [--vscode-menu-border=#454545]
 * @cssprop [--vscode-menu-foreground=#cccccc]
 * @cssprop [--vscode-widget-shadow=rgba(0, 0, 0, 0.36)]
 */
@customElement('vscode-context-menu')
export class VscodeContextMenu extends VscElement {
  static override styles = styles;

  @property({ type: Array, attribute: false })
  set data(data: MenuItemData[]) {
    if (typeof data === 'string') {
      data = JSON.parse(data || '{}')
    }
    console.log("data ---- ", data, typeof data)
    this._data = data;

    const indexes: number[] = [];


    data.forEach((v, i) => {
      if (!v.separator) {
        indexes.push(i);
      }
    });

    this._clickableItemIndexes = indexes;
  }
  get data(): MenuItemData[] {
    return this._data;
  }

  /**
   * By default, the menu closes when an item is clicked. This attribute prevents the menu from closing.
   */
  @property({ type: Boolean, reflect: true, attribute: 'prevent-close' })
  preventClose = false;

  @property({ type: Boolean, reflect: true })
  set show(show: boolean) {
    this._show = show;
    this._selectedClickableItemIndex = -1;

    if (show) {
      this.updateComplete.then(() => {
        if (this._wrapperEl) {
          this._wrapperEl.focus();
        }

        requestAnimationFrame(() => {
          document.addEventListener('click', this._onClickOutsideBound, {
            once: true,
          });
        });
      });
    }
  }
  get show(): boolean {
    return this._show;
  }

  /** @internal */
  @property({ type: Number, reflect: true })
  override tabIndex = 0;

  constructor() {
    super();
    this.addEventListener('keydown', this._onKeyDown);
  }

  /* connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this._onClickOutsideBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onClickOutsideBound);
  } */

  @state()
  private _selectedClickableItemIndex = -1;

  @state()
  private _show = false;

  @query('.context-menu')
  private _wrapperEl!: HTMLDivElement;

  private _data: MenuItemData[] = [];

  private _clickableItemIndexes: number[] = [];

  private _onClickOutside(ev: MouseEvent) {
    if (!ev.composedPath().includes(this)) {
      this.show = false;
    }
  }

  private _onClickOutsideBound = this._onClickOutside.bind(this);

  private _onKeyDown(ev: KeyboardEvent) {
    const { key } = ev;

    if (
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'Escape' ||
      key === 'Enter'
    ) {
      ev.preventDefault();
    }

    switch (key) {
      case 'ArrowUp':
        this._handleArrowUp();
        break;
      case 'ArrowDown':
        this._handleArrowDown();
        break;
      case 'Escape':
        this._handleEscape();
        break;
      case 'Enter':
        this._handleEnter();
        break;
      default:
    }
  }

  private _handleArrowUp() {
    if (this._selectedClickableItemIndex === 0) {
      this._selectedClickableItemIndex = this._clickableItemIndexes.length - 1;
    } else {
      this._selectedClickableItemIndex -= 1;
    }
  }

  private _handleArrowDown() {
    if (
      this._selectedClickableItemIndex + 1 <
      this._clickableItemIndexes.length
    ) {
      this._selectedClickableItemIndex += 1;
    } else {
      this._selectedClickableItemIndex = 0;
    }
  }

  private _handleEscape() {
    this.show = false;
    document.removeEventListener('click', this._onClickOutsideBound);
  }

  private _dispatchSelectEvent(selectedOption: VscodeContextMenuItem) {
    const { keybinding, label, icon, value, separator, tabindex, itemChildren } = selectedOption;
    // let itemChildren =

    this.dispatchEvent(
      new CustomEvent('vsc-context-menu-select', {
        detail: {
          keybinding,
          label,
          icon,
          separator,
          tabindex,
          value,
          itemChildren,
        },
      }) as VscContextMenuSelectEvent
    );
  }

  private _handleEnter() {
    if (this._selectedClickableItemIndex === -1) {
      return;
    }

    const realItemIndex =
      this._clickableItemIndexes[this._selectedClickableItemIndex];
    const options = this._wrapperEl.querySelectorAll(
      'vscode-context-menu-item'
    );
    const selectedOption = options[realItemIndex];

    this._dispatchSelectEvent(selectedOption);

    if (!this.preventClose) {
      this.show = false;
      document.removeEventListener('click', this._onClickOutsideBound);
    }
  }

  private _onItemClick(event: CustomEvent) {
    const et = event.currentTarget as VscodeContextMenuItem;

    this._dispatchSelectEvent(et);

    if (!this.preventClose) {
      this.show = false;
    }
    // this._openSubmenuIfAny()
  }

  private _onItemMouseOver(event: MouseEvent) {
    const el = event.target as HTMLElement;
    const index = el.dataset.index ? +el.dataset.index : -1;
    const found = this._clickableItemIndexes.findIndex(
      (item) => item === index
    );

    if (found !== -1) {
      this._selectedClickableItemIndex = found;
    }

    this._openSubmenuIfAny()
  }

  private _onItemMouseOut() {
    this._selectedClickableItemIndex = -1;
    const selectedIndex =
      this._clickableItemIndexes[this._selectedClickableItemIndex];
    const item = this.data[selectedIndex];
    let children = JSON.parse(item?.itemChildren || '[]')
    if (!children.length)  {
const existing = this.querySelector('.submenu');
// const existing = this.renderRoot.querySelector('.submenu');
    if (existing) existing.remove();     
      };
  }

  /* _triggerSelected() {
    const item = this.data[this._selectedIndex];
    if (item?.itemChildren?.length) return this._openSubmenuIfAny();
    this.dispatchEvent(new CustomEvent('vsc-click', { detail: item }));
    this.remove();
  } */

  private _openSubmenuIfAny() {
        console.log("_openSubmenuIfAny ---- " )

    const selectedIndex =
      this._clickableItemIndexes[this._selectedClickableItemIndex];
    const item = this.data[selectedIndex];
        console.log("_openSubmenuIfAny item ---- ",selectedIndex, item, typeof item)
    /* let children = JSON.parse(JSON.stringify({
      label: 'Command palette...',
      keybinding: 'Ctrl+Shift+A',
      value: 'menuitem1'
    }) || '{}') */
    let children = JSON.parse(item?.itemChildren || '[]')
        console.log("_openSubmenuIfAny children ---- ",children)
    if (!children.length)  {
// if (!this.preventClose) {
//       this.show = false;
//     }      
      return};
    // if (!item?.itemChildren?.length) return;

    const existing = this.renderRoot.querySelector('.submenu');
    if (existing) existing.remove();

    const submenu = document.createElement('vscode-context-menu');
    // submenu.data = [{
    //   label: 'Command palette...',
    //   keybinding: 'Ctrl+Shift+A',
    //   value: 'menuitem1'
    // }];
    // submenu.data = children;
    // submenu.data = item.itemChildren;
    // submenu.level = this.level + 1;
    // submenu.rtl = this.rtl;
    submenu.classList.add('submenu');
    submenu.style.animation = 'slideIn 120ms ease-out';
        console.log("_openSubmenuIfAny submenu ---- ",submenu,this.renderRoot)
    this.append(submenu);
    // this.renderRoot.append(submenu);

    requestAnimationFrame(() => {
      // Move the data assignment after the element is connected:
  submenu.data = children;
  submenu.show = true;
      console.log("_openSubmenuIfAny requestAnimationFrame ---- ",submenu,this.renderRoot)
});

    /*
        const parentRect = this.renderRoot
          .querySelector(`[data-index="${selectedIndex}"]`)
          ?.getBoundingClientRect();

         if (parentRect) {
          const menuRect = this.getBoundingClientRect();
          const submenuX = true
          // const submenuX = this.rtl
            ? parentRect?.left - 220
            : parentRect?.right;
          const submenuY = parentRect.top;
          // submenu.x = submenuX;
          // submenu.y = submenuY;
          // submenu._adjustPosition();
        } */
  }

  /*   _closeSubmenu() {
      const existing = this.renderRoot.querySelector('.submenu');
      if (existing) existing.remove();
    }

    private _onItemHover(index: number, item: any) {
      if (this.submenuTimer) clearTimeout(this.submenuTimer);
      this._selectedIndex = index;
      this.submenuTimer = setTimeout(() => {
        if (item.itemChildren?.length) this._openSubmenuIfAny();
      }, 150);
    } */

  override render(): TemplateResult {
    /* if (!this._show) return html`${nothing}`;

    return html`
      <div class="context-menu" tabindex="0" @keydown=${this._onKeyDown.bind(this)}>
        ${this.data?.map(
      (item, index) => html`
            <vscode-context-menu-item
              label=${item.label || ''}
              keybinding=${item.keybinding || ''}
              value=${item.value || ''}
              ?separator=${item.separator}
              ?disabled=${item.disabled}
              @vsc-click=${() => this._triggerSelected()}
              @mouseover=${() => this._onItemHover(index, item)}
              data-index=${index}
            ></vscode-context-menu-item>
          `
    )}
      </div>
    `; */


    if (!this._show) {
      return html`${nothing}`;
    }

    const selectedIndex =
      this._clickableItemIndexes[this._selectedClickableItemIndex];

    return html`
      <div class="context-menu" tabindex="0">
        ${this.data
        ? this.data.map(
          (
            {
              label = '',
              icon = '',
              keybinding = '',
              value = '',
              separator = false,
              tabindex = 0,
              itemChildren = '',
            },
            index
          ) => html`
                <vscode-context-menu-item
                  label=${label}
                  icon=${icon}
                  keybinding=${keybinding}
                  value=${value}
                  ?separator=${separator}
                  ?selected=${index === selectedIndex}
                  itemChildren=${(itemChildren)}
                  tabindex=${tabindex}
                  @vsc-click=${this._onItemClick}
                  @mouseover=${this._onItemMouseOver}
                  @mouseout=${this._onItemMouseOut}
                  data-index=${index}
                ></vscode-context-menu-item>
              `
        )
        : html`<slot></slot>`}
      </div>
    `;
  }

  /* override render(): TemplateResult {
    if (!this._show) {
      return html`${nothing}`;
    }

    const selectedIndex =
      this._clickableItemIndexes[this._selectedClickableItemIndex];

    return html`
      <div class="context-menu" tabindex="0">
        ${this.data
          ? this.data.map(
              (
                {
                  label = '',
                  keybinding = '',
                  value = '',
                  separator = false,
                  tabindex = 0,
                },
                index
              ) => html`
                <vscode-context-menu-item
                  label=${label}
                  keybinding=${keybinding}
                  value=${value}
                  ?separator=${separator}
                  ?selected=${index === selectedIndex}
                  tabindex=${tabindex}
                  @vsc-click=${this._onItemClick}
                  @mouseover=${this._onItemMouseOver}
                  @mouseout=${this._onItemMouseOut}
                  data-index=${index}
                ></vscode-context-menu-item>
              `
            )
          : html`<slot></slot>`}
      </div>
    `;
  } */
}

declare global {
  interface HTMLElementTagNameMap {
    'vscode-context-menu': VscodeContextMenu;
  }

  interface GlobalEventHandlersEventMap {
    'vsc-context-menu-select': VscContextMenuSelectEvent;
  }
}
