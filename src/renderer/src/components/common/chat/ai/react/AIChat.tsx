"use client";

// import { cn } from "@/lib/utils";
import {
    ActionBarPrimitive,
    AssistantIf,
    AssistantRuntimeProvider,
    ComposerPrimitive,
    MessagePrimitive,
    ThreadPrimitive,
    useLocalRuntime,
    useMessage,
    useMessageRuntime,
    type ThreadMessageLike,
} from "@assistant-ui/react";
import * as Avatar from "@radix-ui/react-avatar";
/* import {
    ArrowUpIcon,
    CheckIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CopyIcon,
    Pencil1Icon,
    ReloadIcon,
} from "@radix-ui/react-icons"; */
import React, { useEffect, useRef, useState, type FC } from "react";
import EditorCommonUtils from "../../../../../utils/common.utils";
import { Button } from "./components/Button";
import { get } from "svelte/store";
import { _ as svelteI18n } from "svelte-i18n";
// import { useOllamaAdapter } from "./utils/utils";
import { readChunk } from "../../../../../extensions/tiptap/CustomAIExtension/utils/utils";
import { notifyAiFreePlanNotice } from "../../../../../utils/ai/aiFreePlanNotice";

// import React, { useEffect, useState, type FC } from "react";
// import { localRuntime } from "./utils/utils";
/* import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"; */


// function cn(param1: any, param2: any) {
//     return param1
// }

// const t = (key: string) => get(svelteI18n)(key);
/**
 * Utility: Standard class merger placeholder
 */
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}

/**
 * Hook: Reactive wrapper for Svelte-i18n inside React
 */
const useTranslation = () => {
    const [t, setT] = useState(() => get(svelteI18n));

    useEffect(() => {
        // Subscribe to the Svelte store to trigger React re-renders on lang change
        const unsubscribe = svelteI18n.subscribe((value) => {
            setT(() => value);
        });
        return unsubscribe;
    }, []);

    return t;
};

// import { FC } from "react";
// import { 
//     AssistantRuntimeProvider, 
//     useLocalRuntime, 
//     ThreadPrimitive, 
//     ComposerPrimitive, 
//     MessagePrimitive, 
//     ActionBarPrimitive,
//     AssistantIf 
// } from "@assistant-ui/react";

// const t = useTranslation();

export const Chat: FC<{
    sessionId?: string;
    initialMessages?: ThreadMessageLike[];
    initialDifyId?: string;
}> = ({
    sessionId,
    initialMessages,
    initialDifyId,
}) => {
    const t = useTranslation();
    const [attachments, setAttachments] = useState<any[]>([]);
    const [contextEnabled, setContextEnabled] = useState(false);
    const [difyConversationId, setDifyConversationId] = useState<string>(initialDifyId || "");
    const difyConversationIdRef = useRef<string>(initialDifyId || "");

    useEffect(() => {
        difyConversationIdRef.current = difyConversationId;
    }, [difyConversationId]);

    useEffect(() => {
        const next = String(initialDifyId || "").trim();
        if (!next) return;
        if (next === difyConversationIdRef.current) return;
        difyConversationIdRef.current = next;
        setDifyConversationId(next);
    }, [initialDifyId]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleAttachments = (event: any) => {
            const detail = event?.detail || {};
            if (detail.sessionId && sessionId && detail.sessionId !== sessionId) return;
            if (Array.isArray(detail.attachments)) {
                setAttachments(detail.attachments);
            }
        };
        const handleContext = (event: any) => {
            const detail = event?.detail || {};
            if (detail.sessionId && sessionId && detail.sessionId !== sessionId) return;
            if (typeof detail.enabled === "boolean") {
                setContextEnabled(detail.enabled);
            }
        };
        window.addEventListener("ai:attachments-updated", handleAttachments);
        window.addEventListener("ai:context-updated", handleContext);
        return () => {
            window.removeEventListener("ai:attachments-updated", handleAttachments);
            window.removeEventListener("ai:context-updated", handleContext);
        };
    }, [sessionId]);

    const getLatestUserPrompt = (messages: readonly ThreadMessageLike[]) => {
        const latestUserMessage = [...messages]
            .reverse()
            .find((message) => message.role === "user");

        const latestUserText = latestUserMessage?.content
            ?.filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("")
            .trim();

        if (latestUserText) return latestUserText;

        return [...messages]
            .reverse()
            .map((message) =>
                message.content
                    ?.filter((part) => part.type === "text")
                    .map((part) => part.text)
                    .join("")
                    .trim()
            )
            .find(Boolean) || "";
    };

    // NOTE: `useLocalRuntime(adapter, options)` only consumes `initialMessages` from the 2nd argument.
    // Passing it in the adapter object silently does nothing and results in an empty thread on hydration.
    const runtime = useLocalRuntime(
        {
            async *run({ messages }) {
            const safeSessionId = sessionId || "default";
            const requestId = `chat-${safeSessionId}-${Date.now()}`;

            // const basePrompt = messages
            //     .map(m => m.content.filter(p => p.type === "text").map(p => p.text).join(""))
            //     .join("\n\n");

            const latestPrompt = getLatestUserPrompt(messages);

            const globalContext = (typeof window !== "undefined" && (window as any).__dynadocAiContext) || null;
            const contextContent = contextEnabled && globalContext?.content
                ? String(globalContext.content).slice(0, 12000)
                : "";
            const attachmentsMap = (typeof window !== "undefined" && (window as any).__dynadocAiAttachmentsMap) || {};
            const sessionAttachments = Array.isArray(attachmentsMap?.[safeSessionId])
                ? attachmentsMap[safeSessionId]
                : [];
            const attachmentSummary = sessionAttachments.length
                ? `\n\nAttachments:\n${sessionAttachments
                      .map((file: any) => `- ${file.name || file.path || "file"} (${file.mime || "unknown"})`)
                      .join("\n")}`
                : "";

            const prompt = `${contextContent ? `Document context:\n${contextContent}\n\n` : ""}${latestPrompt}${attachmentSummary}`;

            let text = "";
            let done = false;
            let streamBuffer = "";
            let difyIdDispatched = false;
            let finalFullData: string | null = null;

            const maybeUpdateDifyId = (nextId: string) => {
                const cleaned = String(nextId || "").trim();
                if (!cleaned) return;
                if (cleaned === difyConversationIdRef.current) return;
                difyConversationIdRef.current = cleaned;
                setDifyConversationId(cleaned);
                if (!difyIdDispatched && typeof window !== "undefined") {
                    difyIdDispatched = true;
                    window.dispatchEvent(
                        new CustomEvent("ai:dify-id-updated", {
                            detail: { sessionId: safeSessionId, difyId: cleaned },
                        })
                    );
                }
            };

            const parseNdjson = (raw: string) => {
                const lines = String(raw || "")
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean);
                let out = "";
                for (let line of lines) {
                    if (line.startsWith("data:")) line = line.slice(5).trim();
                    if (!line) continue;
                    try {
                        const obj: any = JSON.parse(line);
                        const cid =
                            obj?.conversation_id ||
                            obj?.conversationId ||
                            obj?.conversationID ||
                            obj?.metadata?.conversation_id ||
                            obj?.metadata?.conversationId;
                        if (cid) maybeUpdateDifyId(String(cid));

                        const part =
                            obj?.response ??
                            obj?.answer ??
                            obj?.delta ??
                            obj?.content ??
                            obj?.message ??
                            "";
                        if (typeof part === "string" && part) {
                            out += part;
                        }
                    } catch {
                        // ignore non-JSON lines
                    }
                }
                return out;
            };

            const consumeLines = (chunkText: string) => {
                streamBuffer += String(chunkText || "");
                const lines = streamBuffer.split("\n");
                streamBuffer = lines.pop() || "";
                let delta = "";

                for (let line of lines) {
                    line = String(line || "").trim();
                    if (!line) continue;
                    if (line.startsWith("data:")) line = line.slice(5).trim();
                    if (!line) continue;

                    // Try JSON first (the Go backend streams newline-delimited JSON).
                    try {
                        const obj: any = JSON.parse(line);
                        const cid =
                            obj?.conversation_id ||
                            obj?.conversationId ||
                            obj?.conversationID ||
                            obj?.metadata?.conversation_id ||
                            obj?.metadata?.conversationId;
                        if (cid) maybeUpdateDifyId(String(cid));

                        const part =
                            obj?.response ??
                            obj?.answer ??
                            obj?.delta ??
                            obj?.content ??
                            obj?.message ??
                            "";
                        if (typeof part === "string" && part) {
                            delta += part;
                        }
                        continue;
                    } catch {
                        // fallthrough
                    }

                    // Fallback: use the existing parser to strip wrapper lines.
                    try {
                        delta += readChunk(line + "\n");
                    } catch {
                        delta += line;
                    }
                }

                return delta;
            };

            const offChunk = window.server.ai.onChunk((data: any) => {
                if (data?.requestId && data.requestId !== requestId) return;
                const chunk = typeof data === "string" ? data : data?.content;
                try {
                    text += consumeLines(chunk || "");
                } catch {
                    text += String(chunk || "");
                }
            });
            const offDone = window.server.ai.onDone((data: any) => {
                if (data?.requestId && data.requestId !== requestId) return;
                if (typeof data?.fullData === "string") {
                    finalFullData = data.fullData;
                }
                done = true;
            });

            const payload: any = {
                prompt,
                requestId,
                // The Go backend currently uses `conversationId` in some places; Dify expects `conversation_id`.
                // We'll send both for forwards/backwards compatibility.
                conversation_id: difyConversationIdRef.current || undefined,
                conversationId: difyConversationIdRef.current || undefined,
            };

            try {
                notifyAiFreePlanNotice({ source: "AI Chat" });
                const result = window.server.ai.generate(payload, requestId);
                // Web/mobile driver returns a promise; avoid unhandled rejections.
                if (result && typeof (result as any).catch === "function") {
                    (result as any).catch((err: any) => {
                        text += `\n${String(err?.message || err || "AI request failed")}`;
                        done = true;
                    });
                }
            } catch (err: any) {
                text += `\n${String(err?.message || err || "AI request failed")}`;
                done = true;
            }

            try {
                while (!done) {
                    yield { role: "assistant", content: [{ type: "text", text }] };
                    await new Promise(r => setTimeout(r, 16));
                }

                // Flush any remaining buffered partial line.
                if (streamBuffer.trim()) {
                    try {
                        text += consumeLines(streamBuffer + "\n");
                    } catch {
                        text += streamBuffer;
                    }
                    streamBuffer = "";
                }

                // Prefer the authoritative fullData at completion to avoid rare last-chunk races.
                if (finalFullData) {
                    const parsed = parseNdjson(finalFullData);
                    if (parsed) text = parsed;
                }

                // Ensure we yield the final state after completion so the UI always reflects the full answer.
                yield { role: "assistant", content: [{ type: "text", text }] };
            } finally {
                offChunk?.();
                offDone?.();
            }

            const transcript = messages.map(m => {
                const content = m.content
                    .filter(p => p.type === "text")
                    .map(p => p.text)
                    .join("");
                return { role: m.role, text: content };
            });
            if (text) {
                transcript.push({ role: "assistant", text });
            }

            const firstUser = transcript.find((entry) => entry.role === "user" && entry.text?.trim());
            const lastUser = [...transcript].reverse().find((entry) => entry.role === "user" && entry.text?.trim());
            const lastAssistant = [...transcript]
                .reverse()
                .find((entry) => entry.role === "assistant" && entry.text?.trim());

            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("ai:conversation-updated", {
                    detail: {
                        sessionId: safeSessionId,
                        transcript,
                        updatedAt: new Date().toISOString(),
                        firstUserMessage: firstUser?.text || "",
                        lastUserMessage: lastUser?.text || "",
                        lastAssistantMessage: lastAssistant?.text || ""
                    }
                }));
            }

            return { role: "assistant", content: [{ type: "text", text }] };
            },
        },
        { initialMessages: initialMessages || [] },
    );

    // Hydration bridge (Svelte -> React): allow the host to push a transcript into this thread
    // after async server fetch, without relying on `initialMessages` being re-consumed.
    useEffect(() => {
        if (typeof window === "undefined") return;

        const applyReset = (payload: any) => {
            if (!payload) return;
            const targetSessionId = payload.sessionId;
            if (targetSessionId && sessionId && targetSessionId !== sessionId) return;

            const nextMessages = payload.initialMessages;
            if (Array.isArray(nextMessages)) {
                try {
                    runtime.thread.reset(nextMessages);
                } catch (err) {
                    // In dev, this helps diagnose shape issues with messages.
                    // eslint-disable-next-line no-console
                    console.warn("ai:thread-reset failed", err);
                }
            }

            const nextDifyId = String(payload.initialDifyId || payload.difyId || "").trim();
            if (nextDifyId && nextDifyId !== difyConversationIdRef.current) {
                difyConversationIdRef.current = nextDifyId;
                setDifyConversationId(nextDifyId);
            }
        };

        const handler = (event: any) => applyReset(event?.detail);
        window.addEventListener("ai:thread-reset", handler);

        // Also apply once on mount for the initial props if present.
        if (Array.isArray(initialMessages) && initialMessages.length) {
            applyReset({ sessionId, initialMessages, initialDifyId });
        }

        return () => window.removeEventListener("ai:thread-reset", handler);
        // Intentionally exclude `initialMessages` from deps to avoid nuking the thread mid-conversation.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runtime, sessionId, initialDifyId]);

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {/* Adobe 2025 Surface: Neutral Gray high-precision container */}
            <div className="h-full w-full bg-base-100 text-[#d1d1d1] font-sans overflow-hidden flex flex-col border-l border-white/5 shadow-2xl">

                <ThreadPrimitive.Root className="flex h-full flex-col items-stretch">

                    {/* VIEWPORT: Adobe Scrollable Mesh */}
                    <ThreadPrimitive.Viewport className="flex-grow overflow-y-auto px-6 py-4 custom-scrollbar bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/[0.02] via-transparent to-transparent">
                        <ThreadPrimitive.Empty>
                            <div className="flex flex-col items-center justify-center h-full py-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="relative group">
                                    <div className="absolute -inset-4 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-all"></div>
                                    <div className="relative bg-base-200 border border-white/10 p-4 rounded-2xl shadow-2xl">
                                        <i className="ph-light ph-sparkle text-primary text-4xl"></i>
                                    </div>
                                </div>
                                <h1 className="text-center mt-8 text-xl font-bold tracking-tight text-base-content tracking-[0.2em]">
                                    {/* {t("I'm Edem, your Contextual Assistant")} */}
                                    {t("I'm Edem, your Contextual Assistant")}
                                </h1>
                                <p className="mt-3 text-base-content/40 text-[11px] font-medium max-w-[200px] text-center leading-relaxed">
                                    {t("I am analyzing your active document. Ask me to rewrite, summarize, or translate.")}
                                </p>
                            </div>
                        </ThreadPrimitive.Empty>

                        <ThreadPrimitive.Messages
                            components={{
                                UserMessage,
                                AssistantMessage,
                            }}
                        />
                    </ThreadPrimitive.Viewport>

                    {/* ADOBE FLOATING INPUT: Positioned as a "Utility Dock" */}
                    <div className="p-4 bg-base-100 border-t border-white/5">
                        <ComposerPrimitive.Root className="group relative bg-base-200 border border-white/10 rounded-lg p-3 shadow-inner transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
                            <ComposerPrimitive.Input
                                placeholder={t("Command the assistant...")}
                                className="w-full bg-transparent text-[13px] text-base-content outline-none border-none placeholder:text-base-content/20 min-h-[40px] resize-none"
                            />
                            {attachments.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {attachments.map((file: any, idx: number) => (
                                        <button
                                            key={`${file?.path || file?.name || "file"}-${idx}`}
                                            className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5 text-[10px] text-base-content/60 hover:text-base-content hover:bg-white/10"
                                            onClick={() => {
                                                if (typeof window !== "undefined") {
                                                    window.dispatchEvent(
                                                        new CustomEvent("ai:attachments-remove", {
                                                            detail: { sessionId: sessionId || "default", index: idx }
                                                        })
                                                    );
                                                }
                                            }}
                                            title={t("Remove attachment")}
                                        >
                                            <i className="ph-bold ph-paperclip text-[12px]" />
                                            <span className="max-w-[140px] truncate">
                                                {file?.name || file?.path || t("Attachment")}
                                            </span>
                                            <i className="ph-bold ph-x text-[10px] opacity-60" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                <div className="flex items-center gap-1">
                                    <button
                                        className="p-1.5 hover:bg-white/5 rounded-md text-base-content/30 hover:text-base-content transition-all"
                                        onClick={() => {
                                            if (typeof window !== "undefined") {
                                                window.dispatchEvent(
                                                    new CustomEvent("ai:attachments-request", {
                                                        detail: { sessionId: sessionId || "default" }
                                                    })
                                                );
                                            }
                                        }}
                                        title={t("Attach files")}
                                    >
                                        <i className="ph-bold ph-paperclip text-[16px]"></i>
                                    </button>
                                    <button
                                        className={`flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all ${
                                            contextEnabled ? "text-primary" : "text-base-content/30 hover:text-primary"
                                        }`}
                                        onClick={() => {
                                            if (typeof window !== "undefined") {
                                                window.dispatchEvent(
                                                    new CustomEvent("ai:context-toggle", {
                                                        detail: { sessionId: sessionId || "default" }
                                                    })
                                                );
                                            }
                                        }}
                                    >
                                        <div className={`size-1.5 rounded-full ${contextEnabled ? "bg-primary animate-pulse33" : "bg-white/30"}`}></div>
                                        <span>{contextEnabled ? t("Context On") : t("Full Doc Context")}</span>
                                    </button>
                                </div>

                                <AssistantIf condition={({ thread }) => !thread.isRunning}>
                                    <ComposerPrimitive.Send className="bg-primary hover:bg-primary/80 text-primary-content px-4 py-1.5 rounded-md flex items-center gap-2 transition-all shadow-lg active:scale-95">
                                        <span className="text-[10px] font-black uppercase tracking-widest">{t("Execute")}</span>
                                        <i className="ph-bold ph-arrow-right text-[12px]"></i>
                                    </ComposerPrimitive.Send>
                                </AssistantIf>
                            </div>
                        </ComposerPrimitive.Root>

                        <div className="mt-3 text-[9px] text-center text-base-content/20 font-medium uppercase tracking-[0.1em]">
                            {t("Dashmake Inc © 2026 • dynadoc AI Engine")}
                        </div>
                    </div>
                </ThreadPrimitive.Root>
            </div>
        </AssistantRuntimeProvider>
    );
};

export const ChatDify: FC = () => {
    const t = useTranslation();

    const runtime = useLocalRuntime(
        {
            async *run({ messages }) {
            // Convert messages to Dify format or just take the last input
            const lastMessage = messages[messages.length - 1];
            const query = lastMessage.content
                .filter(p => p.type === "text")
                .map(p => p.text)
                .join("");

            const response = await fetch("http://your-dify-ip/v1/chat-messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer {YOUR_DIFY_API_KEY}`,
                },
                body: JSON.stringify({
                    inputs: {}, // Any variables defined in Dify
                    query: query,
                    user: "eddie_user_01",
                    response_mode: "streaming",
                    conversation_id: "", // Store this to maintain thread history
                }),
            });

            if (!response.ok) throw new Error("Dify connection failed");

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";

            while (true) {
                const { done, value } = await reader!.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });

                // Dify sends data in SSE format: data: {"event": "message", "answer": "..."}
                const lines = chunk.split("\n");
                for (const line of lines) {
                    if (line.startsWith("data:")) {
                        try {
                            const data = JSON.parse(line.slice(5));
                            if (data.event === "message" || data.event === "agent_message") {
                                accumulatedText += data.answer;
                                yield {
                                    role: "assistant",
                                    content: [{ type: "text", text: accumulatedText }]
                                };
                            }
                        } catch (e) {
                            // Ignore heartbeat or partial chunks
                        }
                    }
                }
            }
            },
        },
        {},
    );

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {/* Adobe 2025 Surface: Neutral Gray high-precision container */}
            <div className="h-full w-full bg-base-100 text-[#d1d1d1] font-sans overflow-hidden flex flex-col border-l border-white/5 shadow-2xl">

                <ThreadPrimitive.Root className="flex h-full flex-col items-stretch">

                    {/* VIEWPORT: Adobe Scrollable Mesh */}
                    <ThreadPrimitive.Viewport className="flex-grow overflow-y-auto px-6 py-4 custom-scrollbar bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/[0.02] via-transparent to-transparent">
                        <ThreadPrimitive.Empty>
                            <div className="flex flex-col items-center justify-center h-full py-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="relative group">
                                    <div className="absolute -inset-4 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-all"></div>
                                    <div className="relative bg-base-200 border border-white/10 p-4 rounded-2xl shadow-2xl">
                                        <i className="ph-light ph-sparkle text-primary text-4xl"></i>
                                    </div>
                                </div>
                                <h1 className="text-center mt-8 text-xl font-bold tracking-tight text-base-content tracking-[0.2em]">{t("I'm Edem, your Contextual Assistant")}</h1>
                                <p className="mt-3 text-base-content/40 text-[11px] font-medium max-w-[200px] text-center leading-relaxed">
                                    {t("I am analyzing your active document. Ask me to rewrite, summarize, or translate.")}
                                </p>
                            </div>
                        </ThreadPrimitive.Empty>

                        <ThreadPrimitive.Messages
                            components={{
                                UserMessage,
                                AssistantMessage,
                            }}
                        />
                    </ThreadPrimitive.Viewport>

                    {/* ADOBE FLOATING INPUT: Positioned as a "Utility Dock" */}
                    <div className="p-4 bg-base-100 border-t border-white/5">
                        <ComposerPrimitive.Root className="group relative bg-base-200 border border-white/10 rounded-lg p-3 shadow-inner transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
                            <ComposerPrimitive.Input
                                placeholder={t("Command the assistant...")}
                                className="w-full bg-transparent text-[13px] text-base-content outline-none border-none placeholder:text-base-content/20 min-h-[40px] resize-none"
                            />

                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                <div className="flex items-center gap-1">
                                    <button className="p-1.5 hover:bg-white/5 rounded-md text-base-content/30 hover:text-base-content transition-all">
                                        <i className="ph-bold ph-paperclip text-[16px]"></i>
                                    </button>
                                    <button className="flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded-md text-[9px] font-bold uppercase tracking-widest text-base-content/30 hover:text-primary transition-all">
                                        <div className="size-1.5 rounded-full bg-primary animate-pulse33"></div>
                                        <span>{t("Full Doc Context")}</span>
                                    </button>
                                </div>

                                <AssistantIf condition={({ thread }) => !thread.isRunning}>
                                    <ComposerPrimitive.Send className="bg-primary hover:bg-primary/80 text-primary-content px-4 py-1.5 rounded-md flex items-center gap-2 transition-all shadow-lg active:scale-95">
                                        <span className="text-[10px] font-black uppercase tracking-widest">{t("Execute")}</span>
                                        <i className="ph-bold ph-arrow-right text-[12px]"></i>
                                    </ComposerPrimitive.Send>
                                </AssistantIf>
                            </div>
                        </ComposerPrimitive.Root>

                        <div className="mt-3 text-[9px] text-center text-base-content/20 font-medium uppercase tracking-[0.1em]">
                            {t("Dashmake Inc © 2026 • Edem AI")}
                        </div>
                    </div>
                </ThreadPrimitive.Root>
            </div>
        </AssistantRuntimeProvider>
    );
};


/* --- SUB-COMPONENTS --- */

const UserMessage: FC = () => {
    return (
        <MessagePrimitive.Root className="flex flex-col items-end w-full mb-6 animate-in slide-in-from-right-2 fade-in">
            <div className="rounded-xl rounded-tr-none bg-base-200 border border-white/10 px-4 py-2.5 text-base-content/90 max-w-[90%] text-[13px] shadow-lg leading-relaxed">
                <MessagePrimitive.Parts />
            </div>
        </MessagePrimitive.Root>
    )
};

const AssistantMessage: FC = () =>  {
    const t = useTranslation();
    const message = useMessage();
    const messageRuntime = useMessageRuntime();

    const isAssistant = message?.role === "assistant";
    const isLast = message?.isLast;

    const getMessageText = () => {
        try {
            const copyText = messageRuntime?.getCopyText?.();
            if (copyText) return copyText;
        } catch {
            // ignore
        }
        const content = message?.content || [];
        return content
            .filter((part: any) => part?.type === "text")
            .map((part: any) => part?.text || "")
            .join("");
    };

    const handleCopy = async () => {
        const text = getMessageText();
        if (!text) return;
        try {
            await EditorCommonUtils.copyToClipboard(text);
            messageRuntime?.setIsCopied?.(true);
            window.dispatchEvent(
                new CustomEvent("ai:toast", { detail: { message: t("Copied response") } })
            );
            setTimeout(() => messageRuntime?.setIsCopied?.(false), 900);
        } catch {
            window.dispatchEvent(
                new CustomEvent("ai:toast", { detail: { message: t("Copy failed") } })
            );
        }
    };

    const handleRegenerate = () => {
        if (!isAssistant) return;
        messageRuntime?.reload?.();
    };

    const handleSync = () => {
        const text = getMessageText();
        if (!text) return;
        window.dispatchEvent(new CustomEvent("ai:sync-to-doc", { detail: { text } }));
    };

    return (
        <MessagePrimitive.Root className="flex flex-col w-full mb-6 group animate-in slide-in-from-left-2 fade-in">
            <div className="flex items-center gap-2 mb-2 opacity-40">
                <i className="ph-light ph-sparkle text-primary text-[12px]"></i>
                <span className="text-[9px] font-black uppercase tracking-widest">{t("Assistant Response")}</span>
            </div>

            <div className="rounded-xl rounded-tl-none bg-base-200 border border-white/5 px-4 py-3 text-base-content/80 max-w-[95%] text-[13px] shadow-md leading-relaxed">
                <MessagePrimitive.Parts />
            </div>

            <ActionBarPrimitive.Root hideWhenRunning className="flex items-center gap-4 mt-3 text-base-content/30 pl-1">
                <button
                    className="hover:text-primary transition-colors"
                    onClick={handleCopy}
                    title={t("Copy response")}
                >
                    <i className="ph-bold ph-copy text-[16px]" />
                </button>
                <button
                    className={`hover:text-primary transition-colors ${isLast ? '' : 'opacity-40 cursor-not-allowed'}`}
                    onClick={handleRegenerate}
                    disabled={!isLast}
                    title={t("Regenerate")}
                >
                    <i className="ph-bold ph-arrow-clockwise text-[16px]" />
                </button>
                <div className="h-3 w-px bg-white/10"></div>
                <button
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-[9px] font-bold uppercase tracking-widest transition-colors"
                    onClick={handleSync}
                    title={t("Sync to Document")}
                >
                    <i className="ph-bold ph-note-pencil" />
                    <span>{t("Sync to Document")}</span>
                </button>
            </ActionBarPrimitive.Root>
        </MessagePrimitive.Root>
    )
};

const EditComposer: FC = () => {
    const t = useTranslation();
    return (
        <ComposerPrimitive.Root className="w-full bg-[#161b26] rounded-2xl border border-blue-500/50 p-4">
            <ComposerPrimitive.Input className="w-full bg-transparent outline-none text-base-content border-none" />
            <div className="flex justify-end gap-3 mt-4">
                <ComposerPrimitive.Cancel className="text-sm text-[#94a3b8] hover:text-base-content">{t("Cancel")}</ComposerPrimitive.Cancel>
                <ComposerPrimitive.Send className="text-sm text-blue-400 font-bold hover:text-blue-300">{t("Save")}</ComposerPrimitive.Send>
            </div>
        </ComposerPrimitive.Root>
    );
};
