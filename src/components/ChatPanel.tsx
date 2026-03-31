import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Trash2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const STORAGE_KEY = "werkbot-chat-history";

const LEAD_REGEX = /\[LEAD_CAPTURED\]\s*name:\s*(.+)\s*email:\s*(.+)\s*type:\s*(.+)\s*summary:\s*(.+)\s*\[\/LEAD_CAPTURED\]/;

function stripLeadMarker(text: string) {
  return text.replace(/\[LEAD_CAPTURED\][\s\S]*?\[\/LEAD_CAPTURED\]/, "").trim();
}

function extractLead(text: string) {
  const match = text.match(LEAD_REGEX);
  if (!match) return null;
  return {
    name: match[1].trim(),
    email: match[2].trim(),
    type: match[3].trim(),
    summary: match[4].trim(),
  };
}

const DEFAULT_GREETING: Message = {
  role: "assistant",
  content:
    "Hey there! 👋 I'm Werkbot, your WerkandMe assistant. Whether you're curious about our platform or need support, I'm here to help. What can I do for you?",
};

const QUICK_REPLIES = [
  "What is WerkandMe?",
  "Book a Demo",
  "I need support",
];

function loadMessages(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [DEFAULT_GREETING];
}

function saveMessages(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {}
}

// Notification sound using Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

interface ChatPanelProps {
  onClose: () => void;
}

export const ChatPanel = ({ onClose }: ChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const showQuickReplies = messages.length === 1 && messages[0].role === "assistant";

  const sendNotification = async (lead: ReturnType<typeof extractLead>, conversation: Message[]) => {
    if (!lead) return;
    try {
      await supabase.functions.invoke("notify-lead", {
        body: {
          lead,
          conversation: conversation.map((m) => ({
            role: m.role,
            content: stripLeadMarker(m.content),
          })),
        },
      });
    } catch (err) {
      console.error("Failed to send lead notification:", err);
    }
  };

  const handleSend = useCallback(async (overrideInput?: string) => {
    const trimmed = (overrideInput ?? input).trim();
    if (!trimmed || isLoading) return;

    setLastError(null);
    setLastFailedInput(null);

    const userMsg: Message = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!overrideInput) setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length > updatedMessages.length) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev.slice(0, updatedMessages.length), { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: stripLeadMarker(m.content),
          })),
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Play notification sound when response is complete
      playNotificationSound();

      // Check for lead capture
      const lead = extractLead(assistantSoFar);
      if (lead) {
        const finalMessages = [
          ...updatedMessages,
          { role: "assistant" as const, content: assistantSoFar },
        ];
        sendNotification(lead, finalMessages);
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, content: stripLeadMarker(m.content) }
              : m
          )
        );
      }
    } catch (err) {
      console.error("Chat error:", err);
      setLastError("Sorry, I'm having trouble connecting. Please try again.");
      setLastFailedInput(trimmed);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having trouble connecting." },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages]);

  const handleRetry = () => {
    if (!lastFailedInput) return;
    // Remove the last error message
    setMessages((prev) => prev.filter((_, i) => i < prev.length - 1));
    const retryInput = lastFailedInput;
    setLastError(null);
    setLastFailedInput(null);
    // Remove the failed user message too
    setMessages((prev) => prev.filter((_, i) => i < prev.length - 1));
    handleSend(retryInput);
  };

  const handleClearChat = () => {
    setMessages([DEFAULT_GREETING]);
    setLastError(null);
    setLastFailedInput(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="w-[calc(100vw-2rem)] max-w-sm md:w-96 h-[min(500px,70vh)] bg-card rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-chat-header text-chat-header-foreground px-4 py-3 flex items-center justify-between shrink-0 rounded-t-2xl">
        <div>
          <h3 className="font-semibold text-sm">Werkbot</h3>
          <p className="text-xs opacity-80">Your WerkandMe assistant</p>
        </div>
        <button
          onClick={handleClearChat}
          className="opacity-70 hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/10"
          aria-label="Clear chat"
          title="Clear chat"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex animate-fade-in", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-chat-bubble-user text-chat-bubble-user-foreground rounded-br-md"
                  : "bg-chat-bubble-bot text-chat-bubble-bot-foreground rounded-bl-md"
              )}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-a:text-primary prose-a:underline max-w-none">
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {stripLeadMarker(msg.content)}
                  </ReactMarkdown>
                </div>
              ) : (
                stripLeadMarker(msg.content)
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-chat-bubble-bot text-chat-bubble-bot-foreground rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Werkbot is typing</span>
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        {/* Error retry button */}
        {lastError && !isLoading && (
          <div className="flex justify-center animate-fade-in">
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 bg-destructive/10 hover:bg-destructive/15 px-3 py-1.5 rounded-full transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Tap to retry
            </button>
          </div>
        )}

        {/* Quick reply suggestions */}
        {showQuickReplies && !isLoading && (
          <div className="flex flex-wrap gap-2 pt-1 animate-fade-in">
            {QUICK_REPLIES.map((label) => (
              <button
                key={label}
                onClick={() => handleSend(label)}
                className="text-xs bg-accent text-accent-foreground px-3 py-1.5 rounded-full hover:opacity-80 transition-opacity border border-border"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-muted text-foreground rounded-full px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-chat-header text-chat-header-foreground rounded-full h-10 w-10 flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
