import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const SLACK_CHANNEL_ID = "C0AQ3FLAV4L"; // #chatbot channel



serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { lead, conversation } = await req.json();

    if (!lead?.name || !lead?.email || !lead?.type) {
      return new Response(
        JSON.stringify({ error: "Missing lead info (name, email, type)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!SLACK_API_KEY) throw new Error("SLACK_API_KEY is not configured");

    const emoji = lead.type === "sales" ? "💰" : "🛠️";
    const typeLabel = lead.type === "sales" ? "Sales Lead" : "Service Request";

    const convoText = conversation
      .map((m: { role: string; content: string }) =>
        `${m.role === "user" ? "👤 Customer" : "🤖 Bot"}: ${m.content}`
      )
      .join("\n\n");

    const slackMessage = `${emoji} *New ${typeLabel}*\n\n*Name:* ${lead.name}\n*Email:* ${lead.email}\n*Summary:* ${lead.summary || "N/A"}\n\n─── Conversation ───\n${convoText}`;

    // Join the channel first (no-op if already a member)
    await fetch(`${GATEWAY_URL}/conversations.join`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL_ID }),
    });

    const slackResp = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: SLACK_CHANNEL_ID,
        text: slackMessage,
        username: "WerkBot Lead Alert",
        icon_emoji: ":robot_face:",
      }),
    });

    const slackResult = await slackResp.json();
    if (!slackResult.ok) {
      console.error("Slack API error:", JSON.stringify(slackResult));
    }


    return new Response(
      JSON.stringify({
        success: true,
        slack: slackResult.ok ?? false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-lead error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
