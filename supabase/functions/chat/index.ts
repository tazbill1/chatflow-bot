import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a friendly and professional AI assistant for a SaaS company. You handle both sales inquiries and customer service.

## Your capabilities:
- **Sales**: Answer questions about features, pricing, use cases, integrations, and help prospects understand the product value. Encourage them to leave their contact info.
- **Service**: Help existing customers with technical issues, account questions, billing, and general support.

## Behavior rules:
1. Be concise but helpful. Keep responses under 3 sentences unless more detail is needed.
2. If someone seems interested in buying or learning more, ask for their name and email so the team can follow up.
3. If someone has a support issue you can't resolve, collect their name, email, and issue description so the team can help.
4. Always be warm, professional, and solution-oriented.
5. When you've collected lead info (name + email + their need), include the marker [LEAD_CAPTURED] at the very end of your message (the user won't see this).
6. Categorize conversations as either "sales" or "service" based on context.

## Lead capture format:
When you detect a lead, end your message with exactly this (hidden from user):
[LEAD_CAPTURED]
name: <name>
email: <email>
type: <sales|service>
summary: <one-line summary of their need>
[/LEAD_CAPTURED]`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
