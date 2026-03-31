import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ZOHO_ACCOUNTS_URL = "https://accounts.zoho.com/oauth/v2/token";
const ZOHO_CRM_URL = "https://www.zohoapis.com/crm/v2";

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("ZOHO_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET");
  const refreshToken = Deno.env.get("ZOHO_REFRESH_TOKEN");

  if (!clientId) throw new Error("ZOHO_CLIENT_ID is not configured");
  if (!clientSecret) throw new Error("ZOHO_CLIENT_SECRET is not configured");
  if (!refreshToken) throw new Error("ZOHO_REFRESH_TOKEN is not configured");

  const resp = await fetch(ZOHO_ACCOUNTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    console.error("Zoho token refresh failed:", JSON.stringify(data));
    throw new Error(`Zoho token refresh failed [${resp.status}]: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function pushLeadToZoho(lead: {
  name: string;
  email: string;
  type: string;
  summary?: string;
}) {
  const accessToken = await getAccessToken();

  // Split name into first/last
  const nameParts = lead.name.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || firstName;

  const zohoLead = {
    First_Name: firstName,
    Last_Name: lastName || firstName,
    Email: lead.email,
    Lead_Source: "Werkbot Chat",
    Description: lead.summary || "",
    Lead_Status: "Not Contacted",
  };

  const resp = await fetch(`${ZOHO_CRM_URL}/Leads`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: [zohoLead] }),
  });

  const result = await resp.json();
  if (!resp.ok) {
    throw new Error(`Zoho CRM API error [${resp.status}]: ${JSON.stringify(result)}`);
  }

  const record = result.data?.[0];
  if (record?.code !== "SUCCESS") {
    console.error("Zoho lead creation issue:", JSON.stringify(record));
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { lead } = await req.json();

    if (!lead?.name || !lead?.email) {
      return new Response(
        JSON.stringify({ error: "Missing lead name or email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await pushLeadToZoho(lead);

    return new Response(
      JSON.stringify({ success: true, zoho: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("zoho-push-lead error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
