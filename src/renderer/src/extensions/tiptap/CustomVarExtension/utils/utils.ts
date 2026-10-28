import type { DocumentEditorModel } from "../../../../models/Document"
// import SlideDeck from "../../CustomSlideExtension/components/SlideDeck.svelte";
// import CustomVarExtensionVariableChipWidget from "../components/CustomVarExtensionVariableChipWidget.svelte"
import { getVariable } from "../stores/variableManipulator"

/* export let extensionName = 'variable'
export let extensionTagName = 'var'
export let extensionTagAttributeName = "name"
// export let extensionTagAttributeName = VariableManipulatorUtils.VAR_UPDATE_TYPE.name
export let extensionTagAttributeValue = "value" */

export const CustomVarExtensionComponents = {
    nodeView: 'j',
    //   nodeView: SlideDeck,
    //   nodeView: CustomVarExtensionVariableChipWidget,
    // decorationView: SlideDeck,
}

export type VariableInsertMode = 'prepend' | 'append' | 'override' | 'none'
export const VariableInsertModes = {
    prepend: 'prepend',
    append: 'append',
    override: 'override',
    none: 'none', // don't insert variable
} as const;

// export let extensionTagAttributeValue = VariableManipulatorUtils.VAR_UPDATE_TYPE.value
// const extensionTagName = 'variable'

/* 
Extensible helper that detects any kind of link-like or address-like text:

Emails

URLs (http, https, www, ftp, file://, smb://, etc.)

File paths

Anything containing a colon like protocol://

IPv4 links

Localhost

OS paths (C:\folder, /usr/bin/...)
*/
export function isLinkLikeText(text: string): boolean {
    if (!text) return false

    const patterns1 = [
        // Email
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,

        // URLs (http, https, ftp, www)
        /\b(https?|ftp):\/\/[^\s]+/i,
        /\bwww\.[^\s]+/i,

        // file:// , smb:// , custom protocols
        /\b[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/[^\s]+/,

        // IPv4 with port
        /\b\d{1,3}(\.\d{1,3}){3}(:\d+)?\b/,

        // Localhost
        /\blocalhost(:\d+)?\b/,

        // Unix-like paths: /usr/bin, ./folder/file
        /(^|[\s])\/[^.\s][^\s]*/,

        // Windows paths: C:\something
        /[A-Za-z]:\\[^\s]+/,
    ]

    const patterns: RegExp[] = [
        // Email
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,

        // Full URLs with protocol (http, https, ftp, file, smb, custom protocols)
        // - This pattern looks for scheme:// then non-space characters; it is conservative but flexible.
        /[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/[^\s)>\]]+/i,

        // URLs starting with "www."
        /(^|[\s"'(<>])www\.[^\s"'()<>]+/i,

        // Common domain-like patterns (example.com, sub.example.co.uk, with optional port and path)
        /[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:\d+)?(\/[^\s]*)?/,

        // IPv4 (optionally with port)
        /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/,

        // localhost with optional port
        /localhost(?::\d+)?/i,

        // Windows absolute paths, e.g. C:\Users\Name\file.txt
        /[A-Za-z]:\\[^:\s]+/,

        // Unix-like absolute or relative paths e.g. /usr/bin, ./folder/file
        /(^|[\s"'(<>])\/[^\s"'()<>]+/,

        // Anything that looks like protocol:something (e.g., mailto:some, custom-scheme:)
        /[A-Za-z][A-Za-z0-9+\-.]*:[^\s]*/,
    ]

    return patterns.some((p) => p.test(text))
}


// This ensures {http://example.com} never becomes a variable node.
export function isLinkLikeVariable(name: string): boolean {
    if (!name) return false
    // Allow spreadsheet-style references like {uuid!Sheet1!A1} or {uuid!Sheet1!=SUM(A1:A2)}
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:::[^!]+)?!.+/i.test(name)) {
        return false
    }
    return isLinkLikeText(name)
}

export function formatSpreadsheetRefName(value: string): string {
    if (!value) return ''
    const match = value.match(
        /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:::[^!]+)?)!(.+)$/i
    )
    return match?.[2] || value
}

export function transformCurlyBracesToVariableValue(text: string, documentEditor: DocumentEditorModel): string {
    if (!text) return '';
    text = text.toString()
    const regex = /\{([^\}]+)\}/g;
    let result = '';
    let lastIndex = 0;

    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        const fullMatch = match[0];        // "{varname}"
        const varName = match[1].trim();   // "varname"
        const matchStart = match.index;    // start pos of "{varname}"
        const matchEnd = matchStart + fullMatch.length;

        // Append text before {var}
        result += text.slice(lastIndex, matchStart);

        // Get variable value
        const rawValue = getVariable(varName, documentEditor);  // undefined or string
        const value = rawValue ?? `@${varName}`;

        // (Optional) type logic if you have Utils.getVariableType
        // const type = Utils.getVariableType(value);

        // Append replaced value
        result += value;

        lastIndex = matchEnd; // Move cursor after the matched {}
    }

    // Append remaining text after last match
    result += text.slice(lastIndex);

    return result;
}


/* export function transformCurlyBracesToVariableValue2(text: string): string {
    if (!text) return ''

    // Skip transformation for anything resembling link, email, file-path...
    // if (isLinkLikeText(text)) return ''

    const regex = /\{([^\}]+)\}/g
    const content: any[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
        const rawName = match[1].trim()

        // Skip if variable itself looks like a URL, email, file path...
        // if (isLinkLikeVariable(rawName)) continue

        // const value = getVariable(rawName) ?? `@${rawName}`
        const value = getVariable(rawName) ?? `@${rawName}`
        const type = Utils.getVariableType(value)

    }


} */
