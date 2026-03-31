import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const SLACK_CHANNEL_ID = "C0AQ3FLAV4L"; // #chatbot channel
const NOTIFY_EMAILS = ["tom@werkandme.com", "lilli@werkandme.com"];
const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

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

    // Save lead to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase.from("leads").insert({
      name: lead.name,
      email: lead.email,
      type: lead.type,
      summary: lead.summary || null,
      business: lead.business || null,
      phone: lead.phone || null,
      contact_preference: lead.contact_preference || null,
      conversation: conversation || null,
    });

    if (dbError) {
      console.error("Failed to save lead to DB:", dbError);
    }

    // Send Slack notification
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

    const phoneLine = lead.phone ? `\n*Phone:* ${lead.phone}` : "";
    const contactPrefLine = lead.contact_preference ? `\n*Preferred Contact:* ${lead.contact_preference}` : "";
    const businessLine = lead.business ? `\n*Business:* ${lead.business}` : "";

    const slackMessage = `${emoji} *New ${typeLabel}*\n\n*Name:* ${lead.name}\n*Email:* ${lead.email}${businessLine}${phoneLine}${contactPrefLine}\n*Summary:* ${lead.summary || "N/A"}\n\n─── Conversation ───\n${convoText}`;

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

    // Push to Zoho CRM
    let zohoSuccess = false;
    try {
      const zohoUrl = `${supabaseUrl}/functions/v1/zoho-push-lead`;
      const zohoResp = await fetch(zohoUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ lead }),
      });
      const zohoResult = await zohoResp.json();
      zohoSuccess = zohoResult.success ?? false;
      if (!zohoSuccess) {
        console.error("Zoho push failed:", JSON.stringify(zohoResult));
      }
    } catch (zohoErr) {
      console.error("Zoho push error:", zohoErr);
    }

    // Send email notification via SendGrid
    let emailSuccess = false;
    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    if (SENDGRID_API_KEY) {
      try {
        const emailSubject = `${emoji} New ${typeLabel}: ${lead.name}`;
        const emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1a1a2e;">${emoji} New ${typeLabel}</h2>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px;font-weight:bold;color:#555;">Name</td><td style="padding:8px;">${lead.name}</td></tr>
              <tr style="background:#f5f5f5;"><td style="padding:8px;font-weight:bold;color:#555;">Email</td><td style="padding:8px;"><a href="mailto:${lead.email}">${lead.email}</a></td></tr>
              ${lead.business ? `<tr><td style="padding:8px;font-weight:bold;color:#555;">Business</td><td style="padding:8px;">${lead.business}</td></tr>` : ""}
              ${lead.phone ? `<tr style="background:#f5f5f5;"><td style="padding:8px;font-weight:bold;color:#555;">Phone</td><td style="padding:8px;">${lead.phone}</td></tr>` : ""}
              ${lead.contact_preference ? `<tr><td style="padding:8px;font-weight:bold;color:#555;">Preferred Contact</td><td style="padding:8px;">${lead.contact_preference}</td></tr>` : ""}
              <tr style="background:#f5f5f5;"><td style="padding:8px;font-weight:bold;color:#555;">Summary</td><td style="padding:8px;">${lead.summary || "N/A"}</td></tr>
            </table>
            <h3 style="color:#1a1a2e;margin-top:24px;">Conversation</h3>
            <div style="background:#f9f9f9;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;">
              ${conversation.map((m: { role: string; content: string }) =>
                `<p style="margin:8px 0;"><strong>${m.role === "user" ? "👤 Customer" : "🤖 Werkbot"}:</strong> ${m.content}</p>`
              ).join("")}
            </div>
          </div>`;

        const sgResp = await fetch(SENDGRID_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: NOTIFY_EMAILS.map((e) => ({ email: e })) }],
            from: { email: "leads@werkandme.com", name: "WerkBot Lead Alert" },
            subject: emailSubject,
            content: [{ type: "text/html", value: emailHtml }],
          }),
        });

        emailSuccess = sgResp.status >= 200 && sgResp.status < 300;
        if (!emailSuccess) {
          const sgError = await sgResp.text();
          console.error("SendGrid error:", sgResp.status, sgError);
        }
      } catch (emailErr) {
        console.error("Email notification error:", emailErr);
      }
    } else {
      console.warn("SENDGRID_API_KEY not set, skipping email notification");
    }

    return new Response(
      JSON.stringify({
        success: true,
        slack: slackResult.ok ?? false,
        saved: !dbError,
        zoho: zohoSuccess,
        email: emailSuccess,
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
