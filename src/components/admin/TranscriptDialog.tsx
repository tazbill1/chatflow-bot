import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

interface TranscriptDialogProps {
  leadName: string;
  conversation: ConversationMessage[] | null;
}

export function TranscriptDialog({ leadName, conversation }: TranscriptDialogProps) {
  const messages = Array.isArray(conversation) ? conversation : [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-40"
          disabled={messages.length === 0}
          title={messages.length === 0 ? "No conversation recorded" : "View transcript"}
        >
          <Eye className="h-3.5 w-3.5" />
          {messages.length > 0 ? `${messages.length} msgs` : "—"}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-base">Conversation with {leadName}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-3 py-2">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-muted-foreground rounded-bl-sm"
                )}>
                  <p className="text-[10px] font-medium mb-0.5 opacity-70">
                    {msg.role === "user" ? "Visitor" : "Werkbot"}
                  </p>
                  {msg.content}
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No messages recorded.</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
