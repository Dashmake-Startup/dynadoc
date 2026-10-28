import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
// import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  SwatchPicker,
  ColorSwatch,
  Tooltip,
  Button,
  Tab,
} from '@fluentui/react-components';
import type { SwatchPickerOnSelectEventHandler } from '@fluentui/react-components';


type ControlledProp = 'checked' | 'value' | 'selected';

const REACT_EVENT_PROPS = [
  'onClick', 'onChange', 'onInput', 'onFocus', 'onBlur',
  'onKeyDown', 'onKeyUp', 'onSubmit', 'onMouseEnter', 'onMouseLeave'
];

function attrToProp(name: string) {
  return name.replace(/[-_:]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());
}

function parseAttrValue(val: string | null) {
  if (val === null) return undefined;
  const trimmed = val.trim();
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true';
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  try { return JSON.parse(trimmed); } catch { return val; }
}

export function createFluentElement(
  tagName: string,
  Component: React.ComponentType<any>,
  controlledProps: ControlledProp[] = [],
  options?: { wrapChildren?: boolean }
) {
  if (customElements.get(tagName)) return;

  class ReactWrapper extends HTMLElement {
    private _root?: ReactDOM.Root;
    private _observer?: MutationObserver;
    private _rendering = false;
    private _state: Record<string, any> = {};

    connectedCallback() {
      if (!this._root) {
        const container = document.createElement('div');
        this.appendChild(container);
        this._root = ReactDOM.createRoot(container);
      }

      this._observer = new MutationObserver(() => this._scheduleRender());
      this._observer.observe(this, { attributes: true, childList: true, subtree: false });

      this._scheduleRender();
    }

    disconnectedCallback() {
      this._observer?.disconnect();
    }

    private _scheduleRender() {
      if (this._rendering) return;
      this._rendering = true;
      queueMicrotask(() => {
        this._rendering = false;
        this._render();
      });
    }

    private _render() {
      if (!this._root) return;

      let props: Record<string, any> = {};
      // const props: Record<string, any> = {};

      // Map attributes → props
      for (const attr of this.attributes) {
        props[attrToProp(attr.name)] = parseAttrValue(attr.value);
      }

      // Initialize controlled state from attributes if not set
      controlledProps.forEach((prop) => {
        if (this._state[prop] === undefined) {
          this._state[prop] = props[prop];
        }
        props[prop] = this._state[prop];
      });

      // Bridge React events → DOM events
      for (const e of REACT_EVENT_PROPS) {
        if (!(e in props)) {
          const domEvt = e.slice(2).toLowerCase();

          props[e] = (event: any, data?: any) => {
            // Update controlled state if relevant
            controlledProps.forEach((prop) => {
              if (event?.target && prop in event.target) {
                this._state[prop] = event.target[prop];
              } else if (data && prop in data) {
                this._state[prop] = data[prop];
              }
            });

            // Dispatch event to DOM
            this.dispatchEvent(new CustomEvent(domEvt, {
              detail: controlledProps.length
                ? controlledProps.reduce((acc, p) => { acc[p] = this._state[p]; return acc; }, {} as Record<string, any>)
                : event,
              bubbles: true,
              composed: true
            }));

            // Re-render to reflect state changes for controlled props
            if (controlledProps.length) {
              this._scheduleRender();
            }
          };
        }
      }

      // Special handling for select/combobox
      const tagLower = this.tagName.toLowerCase();
      // let children: React.ReactNode = null;
      if (options?.wrapChildren) {
        // Use innerHTML or default child if wrapChildren is true (Tooltip, etc.)
        const inner = this.innerHTML?.trim();
        // this.innerHTML = ''; // <-- clear old content
        // this.style.display = 'none';
        props.children =
          //  = inner
          // ?
          React.createElement('span', { dangerouslySetInnerHTML: { __html: inner } })
        // :
        // React.createElement(Button, { size: 'large' });
      }
      // else
      // if (false) {
      if (options?.wrapChildren) {
        // Preserve all existing children (buttons, divs, spans, etc.)
        const childNodes = Array.from(this.childNodes);
        console.log('wrapChildren Wrapping child childNodes:', childNodes);
        // this.innerHTML = ''; // <-- clear old content
        if (childNodes.length > 0) {
          props.children = childNodes.map((node, i) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Wrap DOM element into React element
              console.log('wrapChildren Wrapping child node eelemeent :', node);
              // return React.createElement('span', { dangerouslySetInnerHTML: { __html: this.innerHTML?.trim() } })
              return React.createElement(
                (node as HTMLElement).tagName.toLowerCase(),
                { key: i, ...Object.fromEntries([...((node as HTMLElement).attributes)].map(a => [a.name, a.value])) },
                // node
                // (node as HTMLElement).innerHTML
                // node.textContent
                // this.innerHTML
                this.textContent
              );
            } else if (node.nodeType === Node.TEXT_NODE) {
              console.log('wrapChildren Wrapping child node teext:', node);
              // return node.textContent;
              // return this.textContent?.trim();
              return React.createElement('span', { dangerouslySetInnerHTML: { __html: this.innerHTML?.trim() } })

            }
            return null;
          })[0];
        } else {
          props.children = null;
        }
        console.log('wrapChildren Wrapping child children:', props, props.children);
      }

      else
        // SwatchPicker special handling
        if (tagLower === 'fluent-swatch-picker') {
          const swatches = Array.from(this.querySelectorAll('fluent-color-swatch'));
          props.children = swatches.map((el, i) => {
            const color = el.getAttribute('color') || '';
            const value = el.getAttribute('value') || '';
            const label = el.getAttribute('aria-label') || '';
            const disabled = el.hasAttribute('disabled');
            // hide original swatch in light DOM
            el.style.display = 'none';

            return React.createElement(ColorSwatch, {
              key: i,
              color,
              value,
              'aria-label': label,
              disabled,
            });
          });

          props.onSelectionChange = (_ev: Event, data: any) => {
            this._state.selectedValue = data.selectedValue; // update controlled prop
            this.dispatchEvent(new CustomEvent('change', {
              detail: { selectedValue: data.selectedValue, selectedSwatch: data.selectedSwatch },
              bubbles: true,
              composed: true,
            }));
          };
        } else
          // TabList special handling
          /* if (tagLower === 'fluent-tab-list') {
            console.log('wrapChildren tagLower:', tagLower);
            const swatches = Array.from(this.querySelectorAll('fluent-tab'));
            props.children = swatches.map((el, i) => {
              const value = el.getAttribute('value') || '';
              const disabled = el.hasAttribute('disabled');
              // hide original swatch in light DOM
              el.style.display = 'none';

              return React.createElement(Tab, {
                key: i,
                value,
                disabled
              });
            });

            props.onSelectionChange = (_ev: Event, data: any) => {
              this._state.selectedValue = data.selectedValue; // update controlled prop
              this.dispatchEvent(new CustomEvent('change', {
                detail: { selectedValue: data.selectedValue, selectedSwatch: data.selectedSwatch },
                bubbles: true,
                composed: true,
              }));
            };
          }  */
          if (tagLower === 'fluent-tab-list') {
            // console.log('wrapChildren tagLower:', tagLower);

            // Extract <fluent-tab> children from light DOM
            const tabs = Array.from(this.querySelectorAll('fluent-tab'));
            props.children = tabs.map((el, i) => {
              const value = el.getAttribute('value') || '';
              const disabled = el.hasAttribute('disabled');
              const id = el.id || `tab-${i}`;
              const iconAttr = el.getAttribute('icon'); // optionally map icon

              // Hide original light DOM
              el.style.display = 'none';

              // Inner text for tab label
              const label = el.textContent?.trim() || '';

              return React.createElement(Tab, {
                key: i,
                id,
                value,
                disabled,
                children: label,
                icon: iconAttr ? React.createElement('span', { innerHTML: iconAttr }) : undefined
              });
            });

            // Controlled selectedValue state
            if (!this._state) this._state = {};
            props.selectedValue = this._state.selectedValue;

            // Event bridging
            props.onTabSelect = (_event: any, data: any) => {
              this._state.selectedValue = data.value; // update selectedValue
              this.dispatchEvent(
                new CustomEvent('tabSelect', {
                  detail: data,
                  bubbles: true,
                  composed: true,
                })
              );
              // Trigger re-render for controlled TabList
              // this._scheduleRender();
            };
          }

          else if (tagLower === 'fluent-color-swatch') {
            // handled inside parent
          } else if (['fluent-select', 'fluent-combobox'].includes(tagLower)) {
            const opts = Array.from(this.querySelectorAll('option'));
            if (opts.length > 0) {
              props.children = opts.map((o, i) =>
                React.createElement('option', { key: i, value: o.value || o.textContent }, o.textContent)
              );
              opts.forEach(o => (o.style.display = 'none'));
            }
          } else

            // Only set children if the element has no React-controlled label/content
            if (!controlledProps.includes('children') && !props.children) {
              const text = this.textContent?.trim();
              if (text) props.children = text;
            }

      const themeAttr = this.getAttribute('theme');
      const theme = themeAttr === 'dark' ? webDarkTheme : webLightTheme;

      // const finalProps = { ...props };
      // Only set children explicitly if it's defined
      if (props.children == undefined) {
        props = [];
      }
      console.log('wrapChildren propos:', props);
      this._root.render(
        <FluentProvider theme={theme} style={{ display: 'contents' }}>
          <Component {...props} />
          {/* <Component {...props}>{children}</Component> */}
        </FluentProvider>
      );
    }
  }

  customElements.define(tagName, ReactWrapper);
}
