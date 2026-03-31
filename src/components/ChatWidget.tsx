import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./ChatPanel";

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6 max-md:bottom-3 max-md:right-3">
      {/* Chat Panel */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out origin-bottom-right",
          isOpen
            ? "scale-100 opacity-100"
            : "scale-0 opacity-0 pointer-events-none"
        )}
      >
        <ChatPanel onClose={() => setIsOpen(false)} />
      </div>

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "rounded-full shadow-lg transition-all duration-300 flex items-center justify-center",
          "bg-chat-header text-chat-header-foreground hover:scale-105 active:scale-95",
          isOpen ? "h-12 w-12 mt-3" : "h-14 w-14 md:h-16 md:w-16"
        )}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-6 w-6 md:h-7 md:w-7" />
        )}
      </button>
    </div>
  );
};
