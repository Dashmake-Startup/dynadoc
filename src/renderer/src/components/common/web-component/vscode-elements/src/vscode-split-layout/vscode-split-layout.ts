import { html, PropertyValues, TemplateResult } from 'lit';
import { property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { customElement, VscElement } from '../includes/VscElement.js';
import styles from './vscode-split-layout.styles.js';
import { stylePropertyMap } from '../includes/style-property-map.js';

const DEFAULT_INITIAL_POSITION = '50%';
const DEFAULT_HANDLE_SIZE = 4;

type PositionUnit = 'pixel' | 'percent';
type Orientation = 'horizontal' | 'vertical';
type FixedPaneType = 'start' | 'end' | 'none';

export const parseValue = (
  raw: string
): { value: number; unit: PositionUnit } => {
  if (!raw) {
    return { value: 0, unit: 'pixel' };
  }

  let unit: PositionUnit;
  let rawVal: number;

  if (raw.endsWith('%')) {
    unit = 'percent';
    rawVal = +raw.substring(0, raw.length - 1);
  } else if (raw.endsWith('px')) {
    unit = 'pixel';
    rawVal = +raw.substring(0, raw.length - 2);
  } else {
    unit = 'pixel';
    rawVal = +raw;
  }

  const value = isNaN(rawVal) ? 0 : rawVal;

  return { unit, value };
};

function parseSizeValue(value: string | null | undefined): number | null {
  if (!value) return null;

  const v = value.trim().toLowerCase();
  if (v === "auto") return null;

  // 1) Percentage
  if (v.endsWith("%")) {
    const num = parseFloat(v.slice(0, -1));
    return isNaN(num) ? null : num;
  }

  // 2) Pixels (px)
  if (v.endsWith("px")) {
    const num = parseFloat(v.slice(0, -2));
    return isNaN(num) ? null : num;
  }

  // 3) Plain number (treated as px)
  const num = parseFloat(v);
  return isNaN(num) ? null : num;
}


// Returns a percentage between 0 and 100
export const pxToPercent = (current: number, max: number) => {
  return max === 0 ? 0 : Math.min(100, (current / max) * 100);
};

export const percentToPx = (current: number, max: number) => {
  return max * (current / 100);
};

export type VscSplitLayoutChangeEvent = CustomEvent<{
  position: number;
  positionInPercentage: number;
}>;
type PaneAttr = { id: string | null; size: string | null; min: string | null; max: string | null; }


/**
 * @tag vscode-split-layout
 *
 * @prop {'start' | 'end' | 'none'} fixedPane
 *
 * @cssprop [--separator-border=#454545]
 * @cssprop [--vscode-editorWidget-border=#454545]
 * @cssprop [--vscode-sash-hoverBorder=#0078d4]
 */
@customElement('vscode-split-layout')
export class VscodeSplitLayout extends VscElement {
  static override styles = styles;

  /**
   * Direction of the divider.
   */
  @property({ reflect: true })
  set split(newVal: Orientation) {
    if (this._split === newVal) {
      return;
    }
    this._split = newVal;
    this.resetHandlePosition();
  }
  get split(): Orientation {
    return this._split;
  }
  private _split: Orientation = 'vertical';

  /**
   * Controls whether the handle position should reset to the value set in the
   * `initialHandlePosition` when it is double-clicked.
   */
  @property({ type: Boolean, reflect: true, attribute: 'reset-on-dbl-click' })
  resetOnDblClick = false;

  /**
   * Controls the draggable area size in pixels. it is intended to use the value
   * of `workbench.sash.size`.
   */
  @property({ type: Number, reflect: true, attribute: 'handle-size' })
  handleSize = 4;

  /**
   * The handler position will reset to this position when it is double-clicked,
   * or the `resetHandlePosition()` is called.
   */
  @property({ reflect: true, attribute: 'initial-handle-position' })
  initialHandlePosition: string = DEFAULT_INITIAL_POSITION;

  /**
   * Set the handle position programmatically. The value must include a unit,
   * either `%` or `px`. If no unit is specified, the value is interpreted as
   * `px`.
   */
  @property({ attribute: 'handle-position' })
  set handlePosition(newVal: string) {
    this._rawHandlePosition = newVal;
    this._handlePositionPropChanged();
  }
  get handlePosition(): string | undefined {
    return this._rawHandlePosition;
  }
  private _rawHandlePosition?: string;

  /**
   * The size of the fixed pane will not change when the component is resized.
   */
  @property({ attribute: 'fixed-pane' })
  set fixedPane(newVal: FixedPaneType) {
    this._fixedPane = newVal;
    this._fixedPanePropChanged();
  }
  get fixedPane(): FixedPaneType {
    return this._fixedPane;
  }
  private _fixedPane: FixedPaneType = 'none';

  @state()
  private _handlePosition = 0;

  @state()
  private _isDragActive = false;

  @state()
  private _hover = false;

  @state()
  private _hide = false;

  @query('.wrapper')
  private _wrapperEl!: HTMLDivElement;

  @query('.handle')
  private _handleEl!: HTMLDivElement;

  @queryAssignedElements({ slot: 'start', selector: 'vscode-split-layout' })
  private _nestedLayoutsAtStart!: HTMLElement[];

  @queryAssignedElements({ slot: 'end', selector: 'vscode-split-layout' })
  private _nestedLayoutsAtEnd!: HTMLElement[];

  private _boundRect: DOMRect = new DOMRect();
  private _handleOffset = 0;
  private _resizeObserver: ResizeObserver;
  private _wrapperObserved: boolean = false;
  private _fixedPaneSize: number = 0;


  private _startMutationObserver?: MutationObserver;
  private _endMutationObserver?: MutationObserver;
  private _startPaneAttr: PaneAttr = { id: null, size: null, min: null, max: null };
  private _endPaneAttr: PaneAttr = { id: null, size: null, min: null, max: null };

  constructor() {
    super();

    this._resizeObserver = new ResizeObserver(this._handleResize);
  }

  /**
   * Sets the handle position to the value specified in the `initialHandlePosition` property.
   */
  resetHandlePosition() {
    if (!this._wrapperEl) {
      this._handlePosition = 0;
      return;
    }

    const { width, height } = this._wrapperEl.getBoundingClientRect();
    const max = this.split === 'vertical' ? width : height;
    const { value, unit } = parseValue(
      this.initialHandlePosition ?? DEFAULT_INITIAL_POSITION
    );

    if (unit === 'percent') {
      this._handlePosition = percentToPx(value, max);
    } else {
      this._handlePosition = value;
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
  }

  protected override firstUpdated(_changedProperties: PropertyValues): void {
    if (this.fixedPane !== 'none') {
      this._resizeObserver.observe(this._wrapperEl);
      this._wrapperObserved = true;
    }

    this._boundRect = this._wrapperEl.getBoundingClientRect();


    this._handleSlotChange()
    // const { width, height } = this._boundRect;
    // const maxPos = this.split === 'vertical' ? width : height;
    this.handlePosition = this._startPaneAttr.size || "50%"
    //  && parseSizeValue(this._startPaneAttr.size) == 0 ? "0" :
    //   ((parseSizeValue(this._startPaneAttr.size) || 0) <= (pxToPercent(parseSizeValue(this._startPaneAttr.max) || 0, maxPos)) ?
    //     this._startPaneAttr.size : this._startPaneAttr.max) || this.handlePosition || '';


    const { value, unit } = this.handlePosition && this.handlePosition.toString().trim() !== ''
      ? parseValue(this.handlePosition)
      : parseValue(this.initialHandlePosition);

    // this._setPosition(0, 'pixel');
    this._setPosition(value, unit);
    this._initFixedPane();
  }

  private _handlePositionPropChanged() {
    if (this.handlePosition && this._wrapperEl) {
      this._boundRect = this._wrapperEl.getBoundingClientRect();
      const { value, unit } = parseValue(this.handlePosition);
      this._setPosition(value, unit);
    }
  }

  private _fixedPanePropChanged() {
    if (!this._wrapperEl) {
      return;
    }

    this._initFixedPane();
  }

  private _initFixedPane() {
    if (this.fixedPane === 'none') {
      if (this._wrapperObserved) {
        this._resizeObserver.unobserve(this._wrapperEl);
        this._wrapperObserved = false;
      }
    } else {
      const { width, height } = this._boundRect;
      const max = this.split === 'vertical' ? width : height;

      this._fixedPaneSize =
        this.fixedPane === 'start'
          ? this._handlePosition
          : max - this._handlePosition;

      if (!this._wrapperObserved) {
        this._resizeObserver.observe(this._wrapperEl);
        this._wrapperObserved = true;
      }
    }
  }

  private _handleResize = (entries: ResizeObserverEntry[]) => {
    const rect = entries[0].contentRect;
    const { width, height } = rect;
    this._boundRect = rect;
    const max = this.split === 'vertical' ? width : height;

    if (this.fixedPane === 'start') {
      this._handlePosition = this._fixedPaneSize;
    }

    if (this.fixedPane === 'end') {
      this._handlePosition = max - this._fixedPaneSize;
    }
  };

  private _setPosition(value: number, unit: PositionUnit) {
    const { width, height } = this._boundRect;
    const max = this.split === 'vertical' ? width : height;

    this._handlePosition = unit === 'percent' ? percentToPx(value, max) : value;
  }

  private _handleMouseOver() {
    this._hover = true;
    this._hide = false;
  }

  private _handleMouseOut(event: MouseEvent) {
    if (event.buttons !== 1) {
      this._hover = false;
      this._hide = true;
    }
  }

  private _handleMouseDown(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();

    this._boundRect = this._wrapperEl.getBoundingClientRect();
    const { left, top } = this._boundRect;
    const { left: handleLeft, top: handleTop } =
      this._handleEl.getBoundingClientRect();

    const mouseXLocal = event.clientX - left;
    const mouseYLocal = event.clientY - top;

    if (this.split === 'vertical') {
      this._handleOffset = mouseXLocal - (handleLeft - left);
    }

    if (this.split === 'horizontal') {
      this._handleOffset = mouseYLocal - (handleTop - top);
    }

    this._isDragActive = true;

    window.addEventListener('mouseup', this._handleMouseUp);
    window.addEventListener('mousemove', this._handleMouseMove);
  }

  private _handleMouseUp = (ev: MouseEvent) => {
    this._isDragActive = false;

    if (ev.target !== this) {
      this._hover = false;
      this._hide = true;
    }

    window.removeEventListener('mouseup', this._handleMouseUp);
    window.removeEventListener('mousemove', this._handleMouseMove);

    const { width, height } = this._boundRect;
    const max = this.split === 'vertical' ? width : height;
    const positionInPercentage = pxToPercent(this._handlePosition, max);

    this.dispatchEvent(
      new CustomEvent('vsc-split-layout-change', {
        detail: {
          position: this._handlePosition,
          positionInPercentage,
        },
        composed: true,
      }) as VscSplitLayoutChangeEvent
    );
  };

  private _handleMouseMove = (event: MouseEvent) => {
    const { clientX, clientY } = event;
    const { left, top, height, width } = this._boundRect;
    const vert = this.split === 'vertical';
    const maxPos = vert ? width : height;
    const mousePos = vert ? clientX - left : clientY - top;

    this._handlePosition = Math.max(
      0,
      Math.min(mousePos - this._handleOffset + this.handleSize / 2, maxPos)
    );

    if (this.fixedPane === 'start') {
      this._fixedPaneSize = this._handlePosition;
    }

    if (this.fixedPane === 'end') {
      this._fixedPaneSize = maxPos - this._handlePosition;
    }
  };

  private _handleDblClick() {
    if (!this.resetOnDblClick) {
      return;
    }

    this.resetHandlePosition();
  }

  // private _startPaneAttr = { size: null, min: null, max: null };
  // private _endPaneAttr = { size: null, min: null, max: null };
  /* private _handleSlotChange() {
    const start = this.shadowRoot!.querySelector(
      "slot[name='start']"
    ) as HTMLSlotElement;

    const end = this.shadowRoot!.querySelector(
      "slot[name='end']"
    ) as HTMLSlotElement;

    const startNode = start.assignedElements()[0] as HTMLElement | undefined;
    const endNode = end.assignedElements()[0] as HTMLElement | undefined;


    if (startNode) this._startPaneAttr = this._readPaneSize(startNode);
    if (endNode) this._endPaneAttr = this._readPaneSize(endNode);

    // Keep normal layout reset behavior
    const nestedLayouts = [
      ...this._nestedLayoutsAtStart,
      ...this._nestedLayoutsAtEnd,
    ];
    nestedLayouts.forEach(e => {
      if (e instanceof VscodeSplitLayout) e.resetHandlePosition();
    });

    this.requestUpdate(); // force re-render with new size rules
  } */

  private _handleSlotChange() {
    const startSlot = this.shadowRoot!.querySelector("slot[name='start']") as HTMLSlotElement;
    const endSlot = this.shadowRoot!.querySelector("slot[name='end']") as HTMLSlotElement;

    const startNode = startSlot.assignedElements()[0] as HTMLElement | undefined;
    const endNode = endSlot.assignedElements()[0] as HTMLElement | undefined;

    // Clear previous observers
    this._startMutationObserver?.disconnect();
    this._endMutationObserver?.disconnect();

    if (startNode) {
      this._startPaneAttr = this._readPaneSize(startNode);

      this._startMutationObserver = new MutationObserver(() => {
        this._startPaneAttr = this._readPaneSize(startNode);
        const { width, height } = this._boundRect;
        const maxPos = this.split === 'vertical' ? width : height;
        const { value, unit } = parseValue(((parseSizeValue(this._startPaneAttr.size) || 0) <= (pxToPercent(parseSizeValue(this._startPaneAttr.max) || 0, maxPos)) ?
          this._startPaneAttr.size : this._startPaneAttr.max) || "");
        this._setPosition(value, unit);
        this.requestUpdate();
      });

      this._startMutationObserver.observe(startNode, {
        attributes: true,
        attributeFilter: ["size", "min", "max"]
      });
    }

    if (endNode) {
      this._endPaneAttr = this._readPaneSize(endNode);

      this._endMutationObserver = new MutationObserver(() => {
        this._endPaneAttr = this._readPaneSize(endNode);
        this.requestUpdate();
      });

      this._endMutationObserver.observe(endNode, {
        attributes: true,
        attributeFilter: ["size", "min", "max"]
      });
    }

    // Keep normal layout reset behavior
    const nestedLayouts = [
      ...this._nestedLayoutsAtStart,
      ...this._nestedLayoutsAtEnd,
    ];
    nestedLayouts.forEach(e => {
      if (e instanceof VscodeSplitLayout) e.resetHandlePosition();
    });

    this.requestUpdate();
  }


  /* private _handleSlotChange2() {
    const nestedLayouts = [
      ...this._nestedLayoutsAtStart,
      ...this._nestedLayoutsAtEnd,
    ];

    nestedLayouts.forEach((e) => {
      if (e instanceof VscodeSplitLayout) {
        e.resetHandlePosition();
      }
    });
  } */

  private _readPaneSize(el: HTMLElement): PaneAttr {
  // private _readPaneSize(el: HTMLElement): { size: string | null; min: string | null; max: string | null; } {
    return {
      id: el.getAttribute("id") ?? null,
      size: el.getAttribute("size") ?? null,
      min: el.getAttribute("min") ?? null,
      max: el.getAttribute("max") ?? null,
    };
  }


  override render(): TemplateResult {
    const { width, height } = this._boundRect;
    const maxPos = this.split === 'vertical' ? width : height;
    const handlePosCss =
      this.fixedPane !== 'none'
        ? `${this._handlePosition}px`
        : `${pxToPercent(this._handlePosition, maxPos)}%`;

    let startPaneSize = '';

    if (this.fixedPane === 'start') {
      startPaneSize = `var(--start-flex-${this._startPaneAttr.id},0 0 ${this._fixedPaneSize}px)`;
      // startPaneSize = `var(--start-flex,0 0 ${this._fixedPaneSize}px)`;
    } else {
      startPaneSize = `var(--start-flex-${this._startPaneAttr.id},1 1 ${pxToPercent(this._handlePosition, maxPos)}%)`;
    }

    let endPaneSize = '';

    if (this.fixedPane === 'end') {
      endPaneSize = `var(--end-flex-${this._startPaneAttr.id},0 0 ${this._fixedPaneSize}px)`;
    } else {
      endPaneSize = `var(--end-flex-${this._startPaneAttr.id},1 1 ${pxToPercent(maxPos - this._handlePosition, maxPos)}%)`;
    }

    const handleStylesPropObj: { [prop: string]: string } = {
      left: this.split === 'vertical' ? handlePosCss : '0',
      // left: this.split === 'vertical' ? ((parseSizeValue(this._startPaneAttr.size) || 0) <= (pxToPercent(parseSizeValue(this._startPaneAttr.max) || 0, maxPos)) ?
      //   this._startPaneAttr.size : this._startPaneAttr.max) || handlePosCss : '0',
      top: this.split === 'vertical' ? '0' : handlePosCss,
      // top: this.split === 'vertical' ? '0' : ((parseSizeValue(this._startPaneAttr.size) || 0) <= (pxToPercent(parseSizeValue(this._startPaneAttr.max) || 0, maxPos)) ?
      //   this._startPaneAttr.size : this._startPaneAttr.max) || handlePosCss,
    };

    const handleSize = this.handleSize ?? DEFAULT_HANDLE_SIZE;

    if (this.split === 'vertical') {
      handleStylesPropObj.marginLeft = `${0 - handleSize / 2}px`;
      handleStylesPropObj.width = `${handleSize}px`;
    }

    if (this.split === 'horizontal') {
      handleStylesPropObj.height = `${handleSize}px`;
      handleStylesPropObj.marginTop = `${0 - handleSize / 2}px`;
    }

    const handleOverlayClasses = classMap({
      'handle-overlay': true,
      active: this._isDragActive,
      'split-vertical': this.split === 'vertical',
      'split-horizontal': this.split === 'horizontal',
    });

    const handleClasses = classMap({
      handle: true,
      hover: this._hover,
      hide: this._hide,
      'split-vertical': this.split === 'vertical',
      'split-horizontal': this.split === 'horizontal',
    });

    const wrapperClasses = {
      wrapper: true,
      horizontal: this.split === 'horizontal',
    };

    return html`
      <div class=${classMap(wrapperClasses)}>
        <div
      class="start"
      .style=${stylePropertyMap({
      // flex: this._startPaneAttr.size ? `0 0 ${this._startPaneAttr.size}` : startPaneSize,
      flex: startPaneSize,
      minWidth: this._startPaneAttr.min || '',
      maxWidth: this._startPaneAttr.max || '',
      // minHeight: this._startPaneAttr.min || '',
      // maxHeight: this._startPaneAttr.max || '',
    })}
    >
          <slot name="start" @slotchange=${this._handleSlotChange}></slot>
        </div>
        <div
      class="end"
      .style=${stylePropertyMap({
      // flex: '1 1 5px',
      // flex: this._endPaneAttr.size ? `0 0 ${this._endPaneAttr.size}` : endPaneSize,
      // flex: `0 0 ${this._endPaneAttr.size || '40px'}`,
      flex: endPaneSize,
      minWidth: this._endPaneAttr.min || '',
      maxWidth: this._endPaneAttr.max || '',
      // minHeight: this._endPaneAttr.min || '',
      // maxHeight: this._endPaneAttr.max || '',
    })}
    >
          <slot name="end" @slotchange=${this._handleSlotChange}></slot>
        </div>
        <div class=${handleOverlayClasses}></div>
        <div
          class=${handleClasses}
          .style=${stylePropertyMap(handleStylesPropObj)}
          @mouseover=${this._handleMouseOver}
          @mouseout=${this._handleMouseOut}
          @mousedown=${this._handleMouseDown}
          @dblclick=${this._handleDblClick}
        ></div>
      </div>
    `;

    return html`
      <div class=${classMap(wrapperClasses)}>
        <div class="start" .style=${stylePropertyMap({ flex: startPaneSize })}>
          <slot name="start" @slotchange=${this._handleSlotChange}></slot>
        </div>
        <div class="end" .style=${stylePropertyMap({ flex: endPaneSize })}>
          <slot name="end" @slotchange=${this._handleSlotChange}></slot>
        </div>
        <div class=${handleOverlayClasses}></div>
        <div
          class=${handleClasses}
          .style=${stylePropertyMap(handleStylesPropObj)}
          @mouseover=${this._handleMouseOver}
          @mouseout=${this._handleMouseOut}
          @mousedown=${this._handleMouseDown}
          @dblclick=${this._handleDblClick}
        ></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vscode-split-layout': VscodeSplitLayout;
  }

  interface GlobalEventHandlersEventMap {
    'vsc-split-layout-change': VscSplitLayoutChangeEvent;
  }
}
