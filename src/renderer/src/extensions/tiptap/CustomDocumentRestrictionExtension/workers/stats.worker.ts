import { Node, Schema, type SchemaSpec } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { Step } from 'prosemirror-transform';
import { CustomAIExtensionProps } from '../../CustomAIExtension/utils/common.utils';
import { CustomMonacoCodeBlockExtensionProps } from '../../CustomMonacoCodeBlockExtension/utils/common.utils';

let doc: Node | null = null;
let schema: Schema = basicSchema;

type WorkerSchemaSpec = {
    nodes?: Record<string, any>;
    marks?: Record<string, any>;
};

function orderedMapToObj(map: any): Record<string, any> {
    const obj: Record<string, any> = {};
    if (!map?.forEach) return obj;
    map.forEach((value: any, key: string) => {
        obj[key] = value;
    });
    return obj;
}

function mergeSpecMaps(
    fallbackMap: Record<string, any>,
    inputMap: Record<string, any> | undefined
): Record<string, any> {
    const merged: Record<string, any> = { ...fallbackMap };
    if (!inputMap) return merged;

    Object.keys(inputMap).forEach((key) => {
        const fallbackSpec = fallbackMap[key] || {};
        const incomingSpec = inputMap[key] || {};
        merged[key] = { ...fallbackSpec, ...incomingSpec };
    });

    return merged;
}

function mergeSchemaSpec(input: WorkerSchemaSpec): SchemaSpec {
    const fallbackNodes = orderedMapToObj((basicSchema as any).spec?.nodes);
    const fallbackMarks = orderedMapToObj((basicSchema as any).spec?.marks);

    return {
        nodes: mergeSpecMaps(fallbackNodes, input.nodes),
        marks: mergeSpecMaps(fallbackMarks, input.marks)
    };
}

self.onmessage = (e: MessageEvent) => {
    const { type, json, steps, schemaSpec, options = {} } = e.data;
    const {
        pageHeight = 1123,
        avgLineHeight = 24
    } = options;

    if (schemaSpec) {
        try {
            const mergedSpec = mergeSchemaSpec(schemaSpec as WorkerSchemaSpec);
            schema = new Schema(mergedSpec);
        } catch (err) {
            console.error("Worker: Failed to create schema from spec:", err);
            schema = basicSchema;
        }
    }

    const sanitizeNodeJson = (nodeJson: any): any | null => {
        if (!nodeJson || !nodeJson.type) return null;
        if (!schema.nodes[nodeJson.type]) return null;

        const next: any = { ...nodeJson };

        if (Array.isArray(next.marks)) {
            next.marks = next.marks.filter((mark: any) => schema.marks[mark?.type]);
        }

        if (Array.isArray(next.content)) {
            next.content = next.content
                .map((child: any) => sanitizeNodeJson(child))
                .filter(Boolean);
        }

        return next;
    };

    if (type === 'FULL_RELOAD' && json) {
        try {
            doc = Node.fromJSON(schema, json);
        } catch (err) {
            try {
                const sanitized = sanitizeNodeJson(json);
                if (sanitized) {
                    doc = Node.fromJSON(schema, sanitized);
                } else {
                    console.error("Worker: Failed to sanitize document JSON for schema.");
                    return;
                }
            } catch (sanitizeErr) {
                console.error("Worker: Failed to create document from JSON:", err);
                return;
            }
        }
    } else if (type === 'PATCH' && steps && doc) {
        steps.forEach((stepJson: any) => {
            try {
                const step = Step.fromJSON(schema, stepJson);
                const result = step.apply(doc!);
                if (result.doc) doc = result.doc;
            } catch (err) {
                console.error("Worker failed to apply step:", err);
                // If a step fails, we should probably request a full reload
                // as our state is now out of sync.
            }
        });
    }

    if (!doc) return;

    const stats = {
        characters: 0,
        words: 0,
        sentences: 0,
        pages: 1,
        paragraph: 0,
        heading: 0,
        bulletList: 0,
        orderedList: 0,
        [CustomMonacoCodeBlockExtensionProps.name]: 0,
        table: 0,
        image: 0,
        video: 0,
        [CustomAIExtensionProps.name]: 0,
        estimatedHeight: 0,
        pageCount: 1,
        nodeCount: 0
    };

    doc.descendants((node) => {
        stats.nodeCount++;
        const typeName = node.type.name;

        if (node.isText && node.text) {
            const text = node.text;
            stats.characters += text.length;
            stats.words += (text.trim().match(/\b\w+\b/g) || []).length;
            stats.sentences += (text.match(/[.!?]+(?=\s|$)/g) || []).length;

            const lines = Math.ceil(text.length / 80);
            stats.estimatedHeight += lines * avgLineHeight;
        }

        if (stats.hasOwnProperty(typeName)) {
            stats[typeName]++;
        }

        if (typeName === 'paragraph') stats.estimatedHeight += 12;
        else if (typeName === 'heading') stats.estimatedHeight += 40;
        else if (typeName === 'table') stats.estimatedHeight += 200;
        else if (typeName === 'image' || typeName === 'video') stats.estimatedHeight += 300;
        else if (typeName === CustomMonacoCodeBlockExtensionProps.name) stats.estimatedHeight += 100;
        else if (typeName === CustomAIExtensionProps.name) stats.estimatedHeight += 150;
    });

    stats.pageCount = Math.max(1, Math.ceil(stats.estimatedHeight / pageHeight));
    self.postMessage(stats);
};
