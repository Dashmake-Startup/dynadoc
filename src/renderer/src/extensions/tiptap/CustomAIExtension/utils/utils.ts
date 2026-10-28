import { get } from "svelte/store"
import type { DocumentEditorModel } from "../../../../models/Document"
import { _$_documentEditorsList } from "../../../../stores/editor.store"
import { transformCurlyBracesToVariableValue } from "../../CustomVarExtension/utils/utils"
import { v4 as uuidv4 } from 'uuid'

export function readChunk(buffer: string, stringToAppendTo: string = null) {
    // buffer += chunk

    let responseText = ''

    // Split by newlines
    if (!buffer) return ''
    const raw = typeof buffer === 'string' ? buffer : String(buffer)
    const lines = raw.split('\n')

    // Keep the last line in the buffer (might be incomplete)
    buffer = lines.pop() || ''

    for (const line of lines) {
        if (!line.trim()) continue

        if (line.startsWith('Error:') || line.toLowerCase().includes('stream error')) {
            responseText += line
            continue
        }
        try {
            const json = JSON.parse(line)
            if (json.response) {
                console.log('AI chunk:', json.response)
                responseText += json.response
            }
            // You can also detect done if needed:
            // if (json.done) console.log('AI done')
        } catch (err) {
            console.warn('Failed to parse JSON chunk:', line, err)
            // fallback: append raw text
            responseText += line
        }
    }

    return responseText
}
export function runAI(prompt: string, documentEditor: DocumentEditorModel, onLoading?: Function, onChunk?: Function, onDone?: Function) {
    if (!prompt) return
    // isLoading = true
    if (onLoading) onLoading()

    documentEditor = documentEditor || get(_$_documentEditorsList.getActive())

    // response = ""

    // let buffer = ''
    // 1. Create a unique ID for THIS specific node call
    const requestId = uuidv4();

    // 2. Setup the global listeners ONE TIME (or use a filtered approach)
    const handleChunk = (data: any) => {
        console.log('AIrunAIhandleChunk receeived:', { data, requestId })

        // Only process if the ID matches this specific call
        if (data.requestId !== requestId) return;

        const chunk = data.content
        // Only proceed if the data belongs to THIS request
        /* if (data.requestId === currentRequestId) {
            if (data.response) {
                if (onChunk) onChunk(data.response);
            } else if (typeof data === 'string') {
                if (onChunk) onChunk(data);
            }
        } */

        // const content = typeof data === 'string' ? data : data.response;

        console.log('AIrunAI AI chunk receeived:', { chunk })
        if (typeof chunk === 'string' && (chunk.startsWith('Error:') || chunk.toLowerCase().includes('stream error'))) {
            if (onChunk) onChunk(chunk)
            return
        }
        try {
            const json = JSON.parse(chunk)
            if (json.response) {
                console.log('AIrunAI AI chunk:', json.response)
                // responseText += json.response
                if (onChunk) onChunk(json.response)
            }
        } catch {
            // raw text
            console.log('AIrunAI AI chunk: catch', chunk)
            // responseText += chunk

            // buffer += chunk

            // responseText += readChunk(chunk)
            if (onChunk) readChunk(chunk)
            // readChunk(buffer)
        }
    };

    const handleDone = (data: any) => {
        console.log('AIrunAIhandleChunk handleDone:', { data, requestId })

        if (data.requestId !== requestId) return;

        // Cleanup listeners to prevent memory leaks
        // window.server.ai.removeListener('chunk', handleChunk);
        // window.server.ai.removeListener('done', handleDone);

        // if (onDone) onDone(readChunk(data.fullData));

        //    if (data.requestId !== requestId) return;
        const fullData = data.fullData

        console.log('AIrunAI AI onDone: fullData', fullData, readChunk(fullData))
        // responseText = readChunk(fullData)
        // if (__onComplete) {
        //     __onComplete(responseText, responseText)
        // }
        if (onDone) onDone(readChunk(fullData))
        // if (onDone) onDone(fullData)
    };

    // Start streaming
    window.server.ai.onChunk(handleChunk)
    /*  window.server.ai.onChunk((chunk) => {
         console.log('AI chunk receeived:', chunk)
         try {
             const json = JSON.parse(chunk)
             if (json.response) {
                 console.log('AI chunk:', json.response)
                 // responseText += json.response
                 if (onChunk) onChunk(json.response)
             }
         } catch {
             // raw text
             console.log('AI chunk: catch', chunk)
             // responseText += chunk
 
             // buffer += chunk
 
             // responseText += readChunk(chunk)
             if (onChunk) readChunk(chunk)
             // readChunk(buffer)
         }
     }) */

    window.server.ai.onDone(handleDone)

    /* window.server.ai.onDone((data) => {
        if (data.requestId !== requestId) return;
        const fullData = data.fullData

        console.log('AI onDone: fullData', fullData, readChunk(fullData))
        // responseText = readChunk(fullData)
        // if (__onComplete) {
        //     __onComplete(responseText, responseText)
        // }
        if (onDone) onDone(readChunk(fullData))
        // if (onDone) onDone(fullData)
    }) */

    // transform potential variables to their value
    prompt = transformCurlyBracesToVariableValue(prompt, documentEditor)
    console.log('AIrunAI : prompt', prompt)

    // Trigger the binary
    window.server.ai.generate(prompt,requestId)
}

export type AIGenerateOptions = {
    mode?: string
    format?: string
    temperature?: number
    metadata?: Record<string, any>
}

export function runAIWithResult(
    prompt: string,
    documentEditor: DocumentEditorModel,
    options: AIGenerateOptions = {},
    onChunk?: (chunk: string) => void
): Promise<string> {
    if (!prompt) return Promise.resolve('')

    documentEditor = documentEditor || get(_$_documentEditorsList.getActive())

    const requestId = uuidv4()

    return new Promise((resolve) => {
        const offChunk = window.server.ai.onChunk((data) => {
            if (data?.requestId !== requestId) return
            const chunk = data.content ?? data.response ?? data
            if (typeof chunk === 'string') {
                if (onChunk) onChunk(readChunk(chunk))
            }
        })

        const offDone = window.server.ai.onDone((data) => {
            if (data?.requestId !== requestId) return
            offChunk?.()
            offDone?.()
            const full = typeof data?.fullData === 'string' ? data.fullData : String(data?.fullData ?? '')
            resolve(readChunk(full))
        })

        const finalPrompt = transformCurlyBracesToVariableValue(prompt, documentEditor)
        window.server.ai.generate({
            prompt: finalPrompt,
            requestId,
            ...options
        })
    })
}

export function runAI2(prompt: string, documentEditor: DocumentEditorModel, onLoading?: Function, onChunk?: Function, onDone?: Function) {
    if (!prompt) return;
    if (onLoading) onLoading();

    // 1. Create a unique ID for THIS specific node call
    const requestId = uuidv4();

    // 2. Setup the global listeners ONE TIME (or use a filtered approach)
    const handleChunk = (data: any) => {
        // Only process if the ID matches this specific call
        if (data.requestId !== requestId) return;

        const content = typeof data === 'string' ? data : data.response;
        if (onChunk) onChunk(readChunk(content));
    };

    const handleDone = (data: any) => {
        if (data.requestId !== requestId) return;

        // Cleanup listeners to prevent memory leaks
        window.server.ai.removeListener('chunk', handleChunk);
        window.server.ai.removeListener('done', handleDone);

        if (onDone) onDone(readChunk(data.fullData));
    };

    window.server.ai.onChunk(handleChunk);
    window.server.ai.onDone(handleDone);

    prompt = transformCurlyBracesToVariableValue(prompt, documentEditor);

    // 3. Pass the requestId to the binary so it can send it back in chunks
    window.server.ai.generate(prompt, requestId);
}
