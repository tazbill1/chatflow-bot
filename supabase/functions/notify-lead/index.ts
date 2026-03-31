import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const NOTIFICATION_EMAILS = ["tom@werkandme.com", "lilli@werkandme.com"];
const SLACK_CHANNEL_ID = "C0AQ3FLAV4L"; // #chatbot channel


async function sendEmailNotifications(
  lead: { name: string; email: string; type: string; summary?: string },
  convoText: string
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for email");
    return;
  }

  const emoji = lead.type === "sales" ? "💰" : "🛠️";
  const typeLabel = lead.type === "sales" ? "Sales Lead" : "Service Request";
  const subject = `${emoji} New ${typeLabel}: ${lead.name}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">${emoji} New ${typeLabel}</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; font-weight: bold; color: #555;">Name</td><td style="padding: 8px;">${lead.name}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #555;">Email</td><td style="padding: 8px;"><a href="mailto:${lead.email}">${lead.email}</a></td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #555;">Type</td><td style="padding: 8px;">${typeLabel}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #555;">Summary</td><td style="padding: 8px;">${lead.summary || "N/A"}</td></tr>
      </table>
      <h3 style="color: #1a1a1a; margin-top: 24px;">Conversation</h3>
      <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${convoText}</div>
    </div>
  `;

  for (const recipientEmail of NOTIFICATION_EMAILS) {
    try {
      const id = crypto.randomUUID();
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateName: "lead-notification",
          recipientEmail,
          idempotencyKey: `lead-notify-${id}-${recipientEmail}`,
          templateData: {
            name: lead.name,
            email: lead.email,
            type: typeLabel,
            summary: lead.summary || "N/A",
            emoji,
            conversation: convoText,
          },
        }),
      });
      const result = await resp.json();
      console.log(`Email to ${recipientEmail}:`, JSON.stringify(result));
    } catch (err) {
      console.error(`Failed to send email to ${recipientEmail}:`, err);
    }
  }
}

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

    // Send email notifications
    sendEmailNotifications(lead, convoText).catch((err) =>
      console.error("Email notification error:", err)
    );

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
