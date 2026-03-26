import { ChatWidget } from "@/components/ChatWidget";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <header className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          AI-Powered Support
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl leading-tight">
          We're here to help you <span className="text-primary">succeed</span>
        </h1>
        <p className="mt-4 text-muted-foreground text-lg md:text-xl max-w-xl">
          Got questions about our product or need support? Chat with our AI assistant — available 24/7.
        </p>
        <p className="mt-8 text-sm text-muted-foreground">
          Click the chat bubble in the bottom-right corner to get started →
        </p>
      </header>

      <ChatWidget />
    </div>
  );
};

export default Index;
