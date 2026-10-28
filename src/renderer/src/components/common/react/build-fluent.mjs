import fs from 'fs';
import path from 'path';
import * as Fluent from '@fluentui/react-components';

// const outDir = path.resolve('generated');
const outDir = path.resolve('src/renderer/src/components/common/react/');
// const outDir = path.resolve('src/preload');
// const outFile = path.join('/src', 'register-fluent.ts')
const outFile = path.join(outDir, 'register-fluent.ts');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let code = `
import React from "react";
import { createRoot } from "react-dom/client";
import { createFluentElement } from "./fluent-wrapper";
import * as Fluent from "@fluentui/react-components";
`;

/* for (const [name, comp] of Object.entries(Fluent)) {
  console.log(`✅ Generating:...`, [name, comp]);
  /* if (typeof comp === 'function' && /^[A-Z]/.test(name)) {
    const tag = `fluent-${name.replace(/[A-Z]/g, m => '-' + m.toLowerCase()).replace(/^-/, '')}`;
    code += `createFluentElement("${tag}", Fluent.${name});\n`;
  } +/
  // for (const [name, comp] of Object.entries(Fluent)) {
    if (comp && typeof comp === 'object' && 'displayName' in comp) {
      console.log(`✅ Generating yes`, [name, comp]);
      const tag = `fluent-${name.replace(/[A-Z]/g, m => '-' + m.toLowerCase()).replace(/^-/, '')}`;
      code += `createFluentElement("${tag}", Fluent.${name});\n`;
      console.log(`✅ Registered: ${name}`);
    }
  // }

} */

// import * as Fluent from '@fluentui/react-components';
const FluentEntries = Object.entries(Fluent)
const [FluentEntriesKeys, FluentEntriesValues] = FluentEntries
// console.log("Fluent", FluentEntriesValues[1], typeof FluentEntriesValues[1])
// if(false){
for (const [key, value] of Object.entries(FluentEntriesValues[1])) {
  // for (const value of FluentEntriesValues) {
  // for (let i = 0; i < FluentEntriesValues[1].length;  i++){
  // let value = FluentEntriesValues[i]
  // let key = FluentEntriesKeys[1][i]

  // for (const [key, value] of FluentEntriesValues) {
  // for (const [key, value] of Object.entries(Fluent)) {
  // console.log("Fluent", key, "--", value, typeof value)
  // Only register React components (skip hooks, tokens, etc.)
  // if (typeof value === 'function' && /^[A-Z]/.test(key)) {
  // if (true) {
  if (typeof value === 'object' && ('render' in value) && value !== null) {
    // console.log("Fluent", key, "--", value, typeof value)
    const tagName = `fluent-${key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()).replace(/^-/, '')}`;
    code += `createFluentElement("${tagName}", Fluent.${key});\n`;
    console.log("createFluentElement -- tagName ", tagName)
    // console.log("createFluentElement code", code, "-- tagName ", tagName)
    console.log(`✅ Registered: ${tagName}`);
  }
}


/* const COMPONENT_NAMES2 = Object.keys(Fluent).filter(n =>
  /^[A-Z]/.test(n) && !n.endsWith('Context') && !n.startsWith('use')
);

const COMPONENT_NAMES = [
  'Accordion',
  'AccordionHeader',
  'AccordionItem',
  'Button',
  'SplitButton',
  // 'TextField',
  'Switch',
  // 'Tabs',
  'Card',
  'Avatar'
];

for (const name of COMPONENT_NAMES) {
   const tag = `${prefix}-${name.toLowerCase()}`;
      createFluentElement(tag, component as React.ComponentType<any>);
  code += `createFluentElement("${name.toLowerCase()}", Fluent.${name});\n`;
  console.log(`✅ Registered: ${name}`);
} */


/* for (const [name, getter] of Object.entries(Fluent)) {
  try {
    // console.log(`✅ Generating:...`, [name, getter]);
    const [compname, comp] = (getter); // Access the getter
    console.log(`✅ Generating comp:...`, comp, typeof comp);
    // const comp = (getter as any); // Access the getter
    // Only register if it looks like a React component (function)
    if (typeof comp === 'function') {
      console.log(`✅ Generating:...`, [name, comp]);
      const tag = `fluent-${name.replace(/[A-Z]/g, m => '-' + m.toLowerCase()).replace(/^-/, '')}`;
      code += `createFluentElement("${tag}", Fluent.${name});\n`;
      console.log(`✅ Registered: ${name}`);
    }
  } catch (e) {
    console.warn(`⚠️ Could not access component ${name}`, e);
  }
}
 */

fs.writeFileSync(outFile, code);
console.log(`✅ Generated: ${outFile}`);
