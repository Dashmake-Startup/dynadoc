

export const extensionName = 'excelTable'
export const extensionShortName = 'excel-table'


export const extensionAttributeNames = {
    var: `data-${extensionShortName}-var`,
    varLabel: `data-${extensionShortName}-var-label`,
    raw: `data-${extensionShortName}-raw`,
    computed: `data-${extensionShortName}-computed`,
    col: `data-${extensionShortName}-col`,
    row: `data-${extensionShortName}-row`,
    sheet: `data-${extensionShortName}-sheet`,
}
export function getRawDataAttribute(node: HTMLElement | { attrs?: Record<string, any>; textContent?: string }, setToTextContentIfNull: boolean = false) {
    let rawValue: string | null = null;



    if (node instanceof HTMLElement) {
        // Get from HTML attribute
        rawValue = node.getAttribute(extensionAttributeNames.raw) ?? null;
        if (setToTextContentIfNull) {
            const pElements = node.querySelectorAll('p')
            rawValue = rawValue || Array.from(pElements)
                .map((p) => p.textContent?.trim() || '')
                .join(' ')
        }
        // rawValue = node?.textContent?.trim()
        // rawValue = node.getAttribute(extensionAttributeNames.raw) || node.getAttribute(extensionAttributeNames.computed);
    } else {
        // Assume Tiptap node
        rawValue =
            (node.attrs?.[extensionAttributeNames.raw]) ??
            // (isInsideFormula(node) ? node.attrs?.[extensionAttributeNames.raw] : null) ??
            // (isInsideFormula(node) ? node.attrs?.[extensionAttributeNames.raw] : node.attrs?.[extensionAttributeNames.computed]) ??

            // node.textContent?.trim() ??
            null;

        if (setToTextContentIfNull) {
            rawValue = rawValue || node.textContent?.trim()
        }

    }

    try {
        if (typeof window !== 'undefined' && (window as any).__DDOC_TABLE_DEBUG__ === true) {
            console.log('initHyperFormula getRawDataAttribute:', rawValue);
        }
    } catch {
        // ignore
    }

    return rawValue;
}
/**
 * Ensure the given string is a formula starting with '='.
 * If it already starts with '=', return as-is.
 * Otherwise, prepend '='.
 */
export function toFormula(value: string): string {
    if (!value) return ''
    return value.startsWith('=') ? value : '=' + value
}
export function normalizeIfFormula(value: string): string {
    if (!value) return ''
    value = value.toString().trim()
    if (!value.startsWith('=')) return value

    // IMPORTANT:
    // Do NOT uppercase the entire formula string.
    // Our table engine stores variable references as `{uuid}` tokens inside formulas.
    // Uppercasing can turn UUID segments like `b527` into `B527` which matches the A1 regex,
    // causing the next parse to treat parts of UUIDs as cell references and corrupt the formula.
    return value
}

/**
 * Check if a node's value is inside a formula (starts with '=')
 */
export function isInsideFormula(node: HTMLElement | { attrs?: Record<string, any> }) {
    // function isInsideFormula(node) {
    let rawValue = ''
    if (node instanceof HTMLElement) {
        // Get from HTML attribute
        rawValue = node.getAttribute(extensionAttributeNames.raw) || ''
    } else {
        rawValue = node.attrs[extensionAttributeNames.raw] || ''
    }
    // Avoid noisy logs in hot paths (typing / recalculation). Enable only when debugging.
    try {
        if (typeof window !== 'undefined' && (window as any).__DDOC_TABLE_DEBUG__ === true) {
            console.log("initHyperFormula isInsideFormula", rawValue.startsWith('='), rawValue)
        }
    } catch {
        // ignore
    }

    return rawValue.startsWith('=')
}
