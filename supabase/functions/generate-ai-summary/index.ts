import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SummaryRequest {
  verification_status: string;
  api_setup_status: string;
  payout_setup_status: string;
  company_name: string;
}

function buildSummary(verification_status: string, api_setup_status: string, payout_setup_status: string): string {
  const parts: string[] = [];
  if (api_setup_status === "Failed") parts.push("API integration failed");
  if (verification_status === "Pending") parts.push("verification is pending");
  if (payout_setup_status === "Pending") parts.push("payout setup is incomplete");

  if (parts.length === 0) return "Ready for activation.";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ".";

  const allButLast = parts.slice(0, -1);
  const last = parts[parts.length - 1];
  return (
    allButLast.map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join(", ") +
    ", and " +
    last +
    "."
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: SummaryRequest = await req.json();
    const summary = buildSummary(body.verification_status, body.api_setup_status, body.payout_setup_status);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
