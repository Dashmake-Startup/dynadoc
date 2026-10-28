import { html, nothing, TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { customElement, VscElement } from '../includes/VscElement.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import styles from './vscode-context-menu-item.styles.js';

export interface VscClickEventDetail {
  label: string;
  icon?: string;
  keybinding: string;
  value: string;
  separator: boolean;
  selected: boolean;
  tabindex: number;
  disabled?: boolean;
  itemChildren?: string;

  // itemChildren?: Array<any>;
}

/**
 * @tag vscode-context-menu-item
 *
 * Child component of [ContextMenu](/components/context-menu/).
 *
 * @cssprop [--vscode-font-family=sans-serif]
 * @cssprop [--vscode-font-size=13px]
 * @cssprop [--vscode-font-weight=normal]
 * @cssprop [--vscode-menu-background=#1f1f1f]
 * @cssprop [--vscode-menu-selectionBorder=transparent]
 * @cssprop [--vscode-menu-foreground=#cccccc]
 * @cssprop [--vscode-menu-selectionBackground=#0078d4]
 * @cssprop [--vscode-menu-selectionForeground=#ffffff]
 * @cssprop [--vscode-menu-separatorBackground=#454545]
 */
@customElement('vscode-context-menu-item')
export class VscodeContextMenuItem extends VscElement {
  static override styles = styles;

  @property({ type: String })
  label = '';

  @property({ type: String })
  icon = '';

  @property({ type: String })
  keybinding = '';

  @property({ type: String })
  value = '';

  @property({ type: Boolean, reflect: true })
  selected = false;

  @property({ type: Boolean, reflect: true })
  separator = false;

  @property({ type: Number })
  tabindex = 0;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  // @property({ type: Array })
  // itemChildren = [];
  @property({ type: String })
  itemChildren = '';

  private onItemClick() {
    /** @internal */
    this.dispatchEvent(
      new CustomEvent<VscClickEventDetail>('vsc-click', {
        detail: {
          label: this.label,
          icon: this.icon,
          keybinding: this.keybinding,
          value: this.value || this.label,
          separator: this.separator,
          disabled: this.disabled,
          selected: this.selected,
          tabindex: this.tabindex,
          itemChildren: (this.itemChildren),
          // itemChildren: JSON.stringify(this.itemChildren),
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  override render(): TemplateResult {
    let children = JSON.parse(this.itemChildren || '[]') 
    // let children = JSON.parse(JSON.stringify([{
    //   label: 'Command palette...',
    //   keybinding: 'Ctrl+Shift+A',
    //   value: 'menuitem122'
    // }]))
    console.log("itemChildren == ",JSON.parse(this.itemChildren || '[]'), this.icon)
    const hasSubmenu = children.length > 0;
    // const hasSubmenu = this.itemChildren?.length > 0;

    return html`
      ${this.separator
        ? html`
            <div class="context-menu-item separator ${this.disabled ? 'disabled' : ''}">
              <span class="ruler"></span>
            </div>
          `
        : html`
            <div class="context-menu-item ${this.disabled ? 'disabled' : ''}">
              <a @click=${this.onItemClick}>
              ${this.icon
            ? html`${unsafeHTML(this.icon)}`
            : nothing}
                ${this.label
            ? html`<span class="label">${this.label}</span>`
            : nothing}
                ${this.keybinding
            ? html`<span class="keybinding">${this.keybinding}</span>`
            : nothing}
                  ${hasSubmenu
            ? html`<span class="submenu-arrow">▶</span>`
            : nothing}
              </a>
            ${false
            ? html`
          <vscode-context-menu
            class="submenu"
            .data=${children}
            .parent=${this}
          ></vscode-context-menu>
        `
            : nothing}
            </div>
          `}
    `;
    // ? html`${unsafeHTML(this.icon)}`
    /* return html`
      ${this.separator
        ? html`
            <div class="context-menu-item separator ${this.disabled ? 'disabled' : ''}">
              <span class="ruler"></span>
            </div>
          `
        : html`
            <div class="context-menu-item ${this.disabled ? 'disabled' : ''}">
              <a @click=${this.onItemClick}>
              ${false
            ? html`<img src=${this.icon} class="icon" alt="" />`
            : html`<span class="icon-placeholder"></span>`}
                ${this.label
            ? html`<span class="label">${this.label}</span>`
            : nothing}
                ${this.keybinding
            ? html`<span class="keybinding">${this.keybinding}</span>`
            : nothing}
                  <span class="submenu-arrow">▶</span>

              </a>
              <vscode-context-menu
            class="submenu" data=${JSON.stringify(children)} .data=${JSON.stringify(children)}

          ></vscode-context-menu>
            </div>
          `}
    `; */

    /*
     const hasSubmenu = this.item.itemChildren?.length > 0;

  return html`
    <div
      class="context-menu-item ${this.selected ? 'selected' : ''} ${this.item.disabled ? 'disabled' : ''}"
      @click=${this._onClick}
    >
      ${this.item.icon
        ? html`<img src=${this.item.icon} class="icon" alt="" />`
        : html`<span class="icon-placeholder"></span>`}

      <span class="label">${this.item.label}</span>

      ${this.item.keybinding
        ? html`<span class="keybinding">${this.item.keybinding}</span>`
        : nothing}

      ${hasSubmenu
        ? html`<span class="submenu-arrow">▶</span>`
        : nothing}
    </div>

    ${hasSubmenu && this.selected
      ? html`
          <vscode-context-menu
            class="submenu"
            .data=${this.item.itemChildren}
            .parent=${this}
          ></vscode-context-menu>
        `
      : nothing}
  `;
    */
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vscode-context-menu-item': VscodeContextMenuItem;
  }
}
