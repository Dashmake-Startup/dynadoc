import { Extension } from '@tiptap/core';
import { IPC_PRESENTATION_START, IPC_PRESENTATION_UPDATE, type PresentationPayload } from '../../../shared/ipc';
import type { Editor } from '@tiptap/core';
import { defaultPaginationOptions, type PaginationPlusOptions } from '../utils/common.utils';
import { presentation } from './store/presentation.store';
import { get } from 'svelte/store';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        CustomPresentationExtension: {
            startPresentation: () => ReturnType
            emitPresentationUpdate: () => ReturnType
        }
    }
}
export interface PaginationOptions {
    pagination: PaginationPlusOptions
}

const defaultOptions: PaginationOptions = { pagination: defaultPaginationOptions }

export const CustomPresentationExtension = Extension.create({
    name: 'presentation',
    addAttributes() {
        return {

            pagination: { default: this.options.pagination },
        }
    },

    addOptions() {
        // return null;
        return defaultOptions;
    },
    addCommands() {
        // const paginationOptions = this.options?.pagination ?? defaultPaginationOptions
        const paginationOptions = this.options?.pagination

        function getNonEditableEditor(editor: Editor): HTMLElement {
            //  function getNonEditableEditor(editor: Editor): string {
            const root = editor.view.dom as HTMLElement
            const clone = root.cloneNode(true) as HTMLElement

            clone.setAttribute('contenteditable', 'false')
            clone
                .querySelectorAll('[contenteditable]')
                .forEach(el => el.removeAttribute('contenteditable'))

            return clone
            // return clone.outerHTML
        }

        // HELPER: Move this inside the scope where 'this' refers to the extension instance
        const getPresentationPayload1 = (editor: Editor) => {
            // Access options directly from 'this' so we get the .configure() overrides
            const currentOptions = this.options.pagination;

            const root = editor.view.dom as HTMLElement;
            const clone = root.cloneNode(true) as HTMLElement;

            clone.setAttribute('contenteditable', 'false');
            clone.querySelectorAll('[contenteditable]')
                .forEach(el => el.removeAttribute('contenteditable'));

            // Sanitize to avoid "Object could not be cloned" error
            const sanitizedOptions = JSON.parse(JSON.stringify(currentOptions));

            const pageBreaks = clone.querySelectorAll('.rm-page-break');

            const payload: PresentationPayload = {
                html: clone.outerHTML,
                pageCount: pageBreaks.length + 1,
                pageWidth: sanitizedOptions?.pageWidth,
                pageHeight: sanitizedOptions?.pageHeight,
                currentIndex: 0,
                editorPaginationOptions: sanitizedOptions
            };

            console.log("payloadpayloadpayload", { payload })
            return payload

        };

        function getPresentationPayload(editor: Editor) {
            const root = getNonEditableEditor(editor);
            // const root = editor.view.dom as HTMLElement;

            // Explicitly destructure only the numeric/string values you need
            const storageOptions = editor?.storage?.PaginationPlus ?? {}
            const mergedOptions = {
                ...paginationOptions,
                ...storageOptions,
                hiddenPages: storageOptions?.hiddenPages ?? paginationOptions?.hiddenPages ?? []
            }
            const sanitizedOptions = JSON.parse(JSON.stringify(mergedOptions));

            const pageBreaks = root.querySelectorAll('.rm-page-break');
            const payload: PresentationPayload = {
                // html: root.innerHTML,
                // html: getNonEditableEditor(editor),
                html: root.outerHTML,
                pageCount: pageBreaks.length + 1,
                // pageWidth: editor?.storage?.PaginationPlus?.pageWidth,
                pageWidth: sanitizedOptions?.pageWidth,
                // pageWidth: 794,
                pageHeight: sanitizedOptions?.pageHeight,
                // pageHeight: 1123,
                currentIndex: 0,
                editorPaginationOptions: sanitizedOptions
            };
            console.log("payloadpayloadpayload", { payload })
            return payload
        }


        return {

            startPresentation:
                () =>
                    ({ editor }) => {
                        /* const root = getNonEditableEditor(editor);
                        // const root = editor.view.dom as HTMLElement;

                        const pageBreaks = root.querySelectorAll('.rm-page-break');
                        const payload: PresentationPayload = {
                            // html: root.innerHTML,
                            // html: getNonEditableEditor(editor),
                            html: root.outerHTML,
                            pageCount: pageBreaks.length + 1,
                            pageWidth: editor.storage.PaginationPlus.pageWidth,
                            // pageWidth: 794,
                            pageHeight: editor.storage.PaginationPlus.pageHeight,
                            // pageHeight: 1123,
                            currentIndex: 0,
                        }; */
                        console.log("startPresentation", { editor })

                        const payload = getPresentationPayload(editor)
                        presentation.update((p) => ({
                            ...p,
                            active: true
                        }))

                        window.presentationAPI.sendData(
                            IPC_PRESENTATION_START,
                            payload
                        );
                        console.log("startPresentation getPresentationPayload", { payload, IPC_PRESENTATION_START})


                        return true;
                    },
            emitPresentationUpdate:
                () =>
                    ({ editor }) => {
                        console.log("emitPresentationUpdate", { editor })
                        if (!get(presentation)?.active) return true
                        const payload = getPresentationPayload(editor)
                        console.log("emitPresentationUpdate", { payload, IPC_PRESENTATION_UPDATE })
                        window.presentationAPI.sendData(IPC_PRESENTATION_UPDATE,
                            payload)
                        return true
                    },
        };
    },
});
