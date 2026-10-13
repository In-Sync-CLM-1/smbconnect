import { supabase } from '@/integrations/supabase/client';

export interface SignupDetails {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

async function call<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  // Edge functions answer 400 with { error } — surface that message, not the generic wrapper.
  if (error) {
    let message = error.message;
    try {
      const payload = await (error as any).context?.json?.();
      if (payload?.error) message = payload.error;
    } catch {
      /* keep generic message */
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/** Creates the unconfirmed account and emails a 6-digit code. */
export function sendSignupCode(details: SignupDetails) {
  return call<{ success: true; userId: string }>('signup-send-otp', { ...details });
}

/** Issues a fresh code for an account that is already waiting for verification. */
export function resendSignupCode(email: string) {
  return call<{ success: true }>('signup-send-otp', { email, resend: true });
}

/** Checks the code, then starts the signed-in session. Returns the user id. */
export async function verifySignupCode(email: string, otp: string): Promise<string> {
  const result = await call<{ success: true; userId: string; tokenHash: string }>('signup-verify-otp', { email, otp });
  const { error } = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: 'magiclink' });
  if (error) throw error;
  return result.userId;
}
