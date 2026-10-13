import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Checks the code, confirms the account and returns a one-time token the browser
// redeems with supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) to start the session.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { email: rawEmail, otp } = await req.json()
    if (!rawEmail || !otp) throw new Error('Email and verification code are required')
    const email = String(rawEmail).trim().toLowerCase()
    const code = String(otp).trim()

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: row } = await admin
      .from('signup_otps')
      .select('id, otp_code, attempts, max_attempts, expires_at')
      .eq('email', email)
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!row) throw new Error('No verification code found. Please request a new one.')
    if (new Date(row.expires_at) < new Date()) throw new Error('This code has expired. Please request a new one.')
    if (row.attempts >= row.max_attempts) throw new Error('Too many wrong attempts. Please request a new code.')

    if (row.otp_code !== code) {
      await admin.from('signup_otps').update({ attempts: row.attempts + 1 }).eq('id', row.id)
      throw new Error('Incorrect code. Please check and try again.')
    }

    // Consume atomically so two requests cannot both use the same code.
    const { data: consumed } = await admin
      .from('signup_otps')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('verified_at', null)
      .select('id')
    if (!consumed || consumed.length === 0) throw new Error('This code was already used. Please request a new one.')

    const { data: profile } = await admin.from('profiles').select('id').ilike('email', email).maybeSingle()
    if (!profile) throw new Error('Account not found')

    const { error: confirmError } = await admin.auth.admin.updateUserById(profile.id, { email_confirm: true })
    if (confirmError) throw new Error('Failed to activate your account')

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (linkError || !linkData?.properties?.hashed_token) throw new Error('Failed to start your session')

    return json({ success: true, userId: profile.id, tokenHash: linkData.properties.hashed_token })
  } catch (error: any) {
    return json({ error: error.message }, 400)
  }
})
