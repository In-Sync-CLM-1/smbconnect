import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

// Records a DPDP Act 2023 consent event. Public (verify_jwt=false) so it works
// both pre-login (account registration, before email confirmation) and while
// authenticated (association / company onboarding). The caller's IP and
// user-agent are captured server-side; the user_id is derived from the bearer
// token when one is present, never trusted from the request body.

interface ConsentBody {
  email: string;
  purpose: string;
  consent_version?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ConsentBody;
    const email = (body.email || "").trim().toLowerCase();
    const purpose = (body.purpose || "").trim();

    if (!email || !purpose) {
      return new Response(JSON.stringify({ error: "email and purpose are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Derive a trustworthy user_id from the bearer token, if supplied.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }

    const forwarded = req.headers.get("x-forwarded-for") || "";
    const ip = forwarded.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;

    const { error } = await supabase.from("consent_records").insert({
      user_id: userId,
      user_identifier: email,
      purpose,
      consent_version: body.consent_version || "1.0",
      consented: true,
      ip_address: ip,
      user_agent: userAgent,
    });

    if (error) {
      console.error("record-consent insert failed:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("record-consent error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
