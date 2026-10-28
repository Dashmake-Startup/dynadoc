
/**
 * Shared constants for CustomInternalLinkExtension.
 * All files in this extension reference these values — never hard-code them inline.
 */
export const CustomInternalLinkExtensionProps = {
    /** ProseMirror / Tiptap mark name */
    name: 'internalLink',

    /** HTML tag used in the DOM to represent an internal link */
    tagName: 'span' as const,

    /** HTML data attribute that stores the target file UUID */
    attributeFileId: 'data-file-id',

    /** HTML data attribute that caches the display label */
    attributeLabel: 'data-label',

    /** CSS class applied to every internal-link span in the editor */
    cssClass: 'dynadoc-internal-link',

    /** data-type sentinel used for parseHTML matching */
    dataType: 'wiki-link',
}
