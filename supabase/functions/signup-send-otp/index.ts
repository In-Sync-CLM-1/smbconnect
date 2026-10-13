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

// Creates the (unconfirmed) account on the first call, then emails a 6-digit code.
// With `resend: true` it only issues a fresh code and never touches the password.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { email: rawEmail, password, firstName, lastName, phone, resend } = await req.json()
    if (!rawEmail) throw new Error('Email is required')
    const email = String(rawEmail).trim().toLowerCase()

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Find an existing account through the sign-in records (profiles do not store the email).
    const { data: existing } = await admin.rpc('signup_lookup_user', { p_email: email })
    const found = Array.isArray(existing) ? existing[0] : existing
    let userId: string | null = found?.id ?? null
    const confirmed = !!found?.confirmed

    if (confirmed) throw new Error('An account with this email already exists. Please sign in.')

    if (resend) {
      if (!userId) throw new Error('No pending sign-up found for this email. Please register again.')
    } else {
      if (!password || String(password).length < 8) throw new Error('Password must be at least 8 characters')
      const metadata = { first_name: firstName, last_name: lastName, phone }
      if (userId) {
        // Earlier attempt never verified: let this attempt replace the password and details.
        const { error } = await admin.auth.admin.updateUserById(userId, { password, user_metadata: metadata })
        if (error) throw new Error('Could not update your sign-up. Please try again.')
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: false,
          user_metadata: metadata,
        })
        if (error || !data?.user) {
          if (error?.message?.toLowerCase().includes('already')) {
            throw new Error('An account with this email already exists. Please sign in.')
          }
          throw new Error(error?.message || 'Could not create your account')
        }
        userId = data.user.id
      }
    }

    // Rate limit: 5 codes per email per 10 minutes.
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('signup_otps')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', since)
    if ((count ?? 0) >= 5) throw new Error('Too many codes requested. Please wait a few minutes and try again.')

    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const otp = String(100000 + (buf[0] % 900000))

    const { error: insertError } = await admin.from('signup_otps').insert({ email, otp_code: otp })
    if (insertError) throw new Error('Failed to generate verification code')

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#f6f9fc;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px 20px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:26px;">Verify your email</h1></td></tr>
<tr><td style="padding:32px 30px;">
<p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 16px;">Welcome to SMB Connect. Enter this code on the sign-up page to activate <strong>${email}</strong>:</p>
<p style="text-align:center;margin:24px 0;"><span style="display:inline-block;background:#f4f4f4;border-radius:8px;padding:18px 28px;font-size:34px;font-weight:bold;letter-spacing:8px;font-family:'Courier New',monospace;color:#333;">${otp}</span></p>
<p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 16px;">The code expires in 15 minutes.</p>
<p style="color:#666;font-size:13px;line-height:1.6;margin:0;">If you did not sign up, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`

    // Same sender as the rest of SMB's auth mail (notifications@in-sync.co.in), echocommunicator Resend account.
    const apiKey = Deno.env.get('AUTH_RESEND_API_KEY') ?? Deno.env.get('RESEND_API_KEY')
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'In-Sync <notifications@in-sync.co.in>',
        to: [email],
        subject: `${otp} is your SMB Connect verification code`,
        html,
      }),
    })
    if (!resendResponse.ok) {
      console.error('[signup-send-otp] resend failed', resendResponse.status, await resendResponse.text())
      throw new Error('Failed to send verification email')
    }

    return json({ success: true, userId })
  } catch (error: any) {
    return json({ error: error.message }, 400)
  }
})
