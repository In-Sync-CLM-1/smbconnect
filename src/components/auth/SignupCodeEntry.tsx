import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { resendSignupCode, verifySignupCode } from '@/lib/signupOtp';

interface Props {
  email: string;
  onVerified: (userId: string) => void | Promise<void>;
}

export function SignupCodeEntry({ email, onVerified }: Props) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    if (code.length !== 6) return;
    try {
      setBusy(true);
      const userId = await verifySignupCode(email, code);
      await onVerified(userId);
    } catch (error: any) {
      setCode('');
      toast({ title: 'Could not verify', description: error.message || 'Please try again', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      setBusy(true);
      await resendSignupCode(email);
      setCode('');
      toast({ title: 'New code sent', description: `Check ${email} for a fresh 6-digit code.` });
    } catch (error: any) {
      toast({ title: 'Could not resend', description: error.message || 'Please try again', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 text-center">
      <p className="text-sm text-muted-foreground">
        We emailed a 6-digit code to <strong>{email}</strong>. Enter it below to activate your account.
      </p>
      <div className="flex justify-center">
        <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={verify} disabled={busy} autoFocus>
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button type="button" className="w-full" onClick={verify} disabled={busy || code.length !== 6}>
        {busy ? 'Verifying...' : 'Verify and continue'}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={resend} disabled={busy}>
        Resend code
      </Button>
    </div>
  );
}
