import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

// BYOK: lets an association's manager or a company's owner/admin bring that
// organisation's own PII encryption key (DPDP Act 2023), or go back to the
// platform default. Same mechanism as IT Helpdesk's set-encryption-key, but
// scoped per organisation instead of one key for the whole system. The caller
// must administer the organisation they name; the key never leaves this
// function except into the Vault via set_org_encryption_key().
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { org_type, org_id, action, encryption_key } = await req.json();
    if ((org_type !== "association" && org_type !== "company") || typeof org_id !== "string") {
      return json({ error: "org_type and org_id are required" }, 400);
    }
    if (action !== "save" && action !== "remove") return json({ error: "Unknown action" }, 400);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: allowed, error: roleErr } = await admin.rpc(
      org_type === "association" ? "is_association_manager" : "is_company_admin",
      { check_user_id: userData.user.id, [org_type === "association" ? "check_association_id" : "check_company_id"]: org_id },
    );
    if (roleErr) throw new Error(roleErr.message);
    if (!allowed) return json({ error: "Only this organisation's administrators can manage its encryption key" }, 403);

    if (action === "save") {
      if (typeof encryption_key !== "string" || encryption_key.length < 16) {
        return json({ error: "Encryption key must be at least 16 characters" }, 400);
      }
    }

    const { error } = await admin.rpc("set_org_encryption_key", {
      p_type: org_type,
      p_id: org_id,
      p_key: action === "save" ? encryption_key : null,
      p_user: userData.user.id,
    });
    if (error) throw new Error(`Could not update the encryption key: ${error.message}`);

    return json({
      success: true,
      message: action === "save"
        ? "Encryption key saved and existing data re-encrypted"
        : "Own key removed; the platform default key is protecting this data again",
    });
  } catch (error) {
    console.error("set-org-encryption-key error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
