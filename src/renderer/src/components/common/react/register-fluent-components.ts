// register-fluent-components.js
import * as Fluent from '@fluentui/react-components';
import { registerReactComponent } from './react-wrapper-factory.js';

function toKebab(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// Iterate through exports and register function components / classes that look like React components
for (const [exportName, Component] of Object.entries(Fluent)) {
  console.log('fluent:  register...');

  if (typeof Component === 'function' && /^[A-Z]/.test(exportName)) {
    console.log('fluent:  register', exportName);

    const tag = 'fluent-react-' + toKebab(exportName);
    try {
      registerReactComponent(tag, Component);
    } catch (e) {
      console.log('fluent: Could not register', exportName, e);
    }
  }
}
