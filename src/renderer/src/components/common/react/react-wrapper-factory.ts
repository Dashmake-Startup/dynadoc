// react-wrapper-factory.js
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';

/**
 * WeakMap cache for React roots to avoid re-creating roots on reconnects.
 * Key: element instance, Value: { root, container, mounted }
 */
const rootCache = new WeakMap();

/** List of React event prop names we want to convert to DOM events */
const REACT_EVENT_PROPS = [
  'onClick', 'onChange', 'onInput', 'onFocus', 'onBlur', 'onKeyDown', 'onKeyUp', 'onSubmit', 'onMouseEnter', 'onMouseLeave'
];

/** Convert kebab-case or snake_case attribute name to camelCase prop name */
function attrToPropName(attr) {
  return attr.replace(/[-_:]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());
}

/** Convert attribute value string to JSON/primitive if possible; fallback to string */
function parseAttrValue(val) {
  if (val === null) return undefined;
  const trimmed = val.trim();
  if (/^(true|false)$/.test(trimmed)) return trimmed === 'true';
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  try {
    return JSON.parse(trimmed);
  } catch {
    return val;
  }
}

/**
 * Register a React component as a custom element.
 * @param {string} tagName - custom element tag name (kebab-case).
 * @param {React.ComponentType<any>} Component - React component to render.
 */
export function registerReactComponent(tagName, Component) {
  if (customElements.get(tagName)) return;

  class ReactWrapper extends HTMLElement {
    constructor() {
      super();
      this._props = {};
      this._mutationObserver = null;
      this._isConnected = false;
      this._childrenContent = null;
    }

    connectedCallback() {
      // Setup MutationObserver to detect attribute and child changes
      if (!this._mutationObserver) {
        this._mutationObserver = new MutationObserver((list) => {
          let needsRerender = false;
          for (const m of list) {
            if (m.type === 'attributes') needsRerender = true;
            if (m.type === 'childList') needsRerender = true;
          }
          if (needsRerender) this._syncAndRender();
        });
        this._mutationObserver.observe(this, { attributes: true, childList: true, subtree: false });
      }

      this._isConnected = true;

      // Create or reuse root
      let cacheEntry = rootCache.get(this);
      if (!cacheEntry) {
        // container inside the custom element to mount React
        const container = document.createElement('div');
        container.style.height = '100%';
        container.style.width = '100%';
        // Attach a light DOM container (not shadow) so Svelte/CSS can wrap; React will render into it
        this.appendChild(container);

        const root = ReactDOM.createRoot(container);
        cacheEntry = { root, container, mounted: false };
        rootCache.set(this, cacheEntry);
      }

      this._syncAndRender();
    }

    disconnectedCallback() {
      // Keep the root in cache (do NOT unmount immediately) — it improves reconnect performance.
      // You can unmount logic here if you want memory cleanup after long time.
      this._isConnected = false;
      // Optionally: schedule unmount after timeout if you want to reclaim memory.
    }

    _collectPropsFromAttributes() {
      const props = {};
      // copy attributes -> camelCase props
      for (let i = 0; i < this.attributes.length; i++) {
        const attr = this.attributes[i];
        const propName = attrToPropName(attr.name);
        props[propName] = parseAttrValue(attr.value);
      }

      // Add children as prop if present (innerHTML as text)
      const inner = this.innerHTML?.trim();
      if (inner) {
        // pass raw text (not HTML) to avoid XSS and unpredictable React rendering
        // If you need HTML children, consider using a slot + portal approach.
        props.children = inner;
      }

      // Attach event-bridges: for each known react event prop (onClick etc), create a function
      for (const rEvent of REACT_EVENT_PROPS) {
        // only add if not already provided in attributes
        if (!(rEvent in props)) {
          // event name for DOM listeners: strip "on" and lowercase first letter: onClick -> click
          const domEventName = rEvent.slice(2);
          const eventNameLower = domEventName.charAt(0).toLowerCase() + domEventName.slice(1);
          props[rEvent] = (...args) => {
            // dispatch a DOM event from the host element so Svelte can listen with on:eventName
            this.dispatchEvent(new CustomEvent(eventNameLower, { detail: args, bubbles: true, composed: true }));
          };
        }
      }

      return props;
    }

    _syncAndRender() {
      if (!this._isConnected) return;
      const cacheEntry = rootCache.get(this);
      if (!cacheEntry) return;
      const { root } = cacheEntry;

      const props = this._collectPropsFromAttributes();

      // Render the React component with collected props
      // If props.children is a string, pass it as child; otherwise rely on provided children
      const children = typeof props.children === 'string' ? props.children : undefined;
      // Remove children from props when passing into component props (React children are separate)
      const propsCopy = { ...props };
      delete propsCopy.children;

      // Render
      root.render(React.createElement(Component, propsCopy, children));

      cacheEntry.mounted = true;
    }
  }

  customElements.define(tagName, ReactWrapper);
}
