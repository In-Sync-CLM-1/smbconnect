import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BackButton } from '@/components/BackButton';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { KeyRound, ShieldCheck } from 'lucide-react';

type OrgType = 'association' | 'company';

interface KeyStatus {
  using_own_key: boolean;
  set_at: string | null;
  rotation_count: number;
}

interface Proof {
  real_value: string;
  stored_ciphertext_hex: string;
  ciphertext_bytes: number;
  decrypts_correctly: boolean;
  key_source: 'own' | 'platform';
}

const MIN_KEY_LENGTH = 16;

// Bring-your-own-key (BYOK) controls for DPDP Act 2023. Each association and
// each company can protect its own contact and tax details with a key only
// it holds, or leave the platform default in place.
export default function OrgEncryption({ orgType }: { orgType: OrgType }) {
  const { toast } = useToast();
  const { userData } = useUserRole();
  const orgId: string | undefined =
    orgType === 'association' ? userData?.association?.id : userData?.company?.id ?? userData?.company_id;
  const orgName: string | undefined = (orgType === 'association' ? userData?.association : userData?.company)?.name;
  const label = orgType === 'association' ? 'association' : 'company';
  const dashboard = orgType === 'association' ? '/association' : '/company';

  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [proof, setProof] = useState<Proof | null>(null);
  const [proofLoading, setProofLoading] = useState(false);

  // The new RPCs are not in the generated types yet.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: any; error: { message: string } | null }>;

  const loadStatus = useCallback(async () => {
    if (!orgId) return;
    const { data, error } = await rpc('get_org_encryption_status', { p_type: orgType, p_id: orgId });
    if (error) {
      toast({ title: 'Could not load encryption status', description: error.message, variant: 'destructive' });
      return;
    }
    setStatus((Array.isArray(data) ? data[0] : data) as KeyStatus);
  }, [orgId, orgType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const callKeyFunction = async (action: 'save' | 'remove') => {
    if (!orgId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-org-encryption-key', {
        body: { org_type: orgType, org_id: orgId, action, encryption_key: action === 'save' ? key : undefined },
      });
      if (error) {
        // Surface the real reason, not the generic non-2xx wrapper.
        let message = error.message;
        try {
          const body = await (error as any).context?.json();
          if (body?.error) message = body.error;
        } catch { /* keep generic message */ }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      toast({ title: action === 'save' ? 'Encryption key saved' : 'Your own key was removed', description: data?.message });
      setKey('');
      setProof(null); // stale: data was just re-encrypted
      await loadStatus();
    } catch (e: any) {
      toast({ title: 'Could not update the encryption key', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
      setConfirmRemove(false);
    }
  };

  const showProof = async () => {
    if (!orgId) return;
    setProofLoading(true);
    const { data, error } = await rpc('get_org_encryption_proof', { p_type: orgType, p_id: orgId });
    setProofLoading(false);
    if (error) {
      toast({ title: 'Could not load the proof', description: error.message, variant: 'destructive' });
      return;
    }
    setProof((Array.isArray(data) ? data[0] : data) as Proof);
  };

  const ownKey = !!status?.using_own_key;
  const protectedFields =
    orgType === 'association'
      ? 'contact email and contact phone'
      : 'email, phone, GST number and PAN number';

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 !pl-20 md:!pl-24 max-w-3xl space-y-6">
        <BackButton fallbackPath={dashboard} variant="ghost" label="Back" />

        <div>
          <h1 className="text-3xl font-bold">Data Encryption Key</h1>
          <p className="text-muted-foreground mt-2">
            {orgName ? `${orgName} — ` : ''}protect your {label}'s {protectedFields} with a key that only you hold.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-4 w-4" /> Your encryption key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              AES-256 encryption for personal and business details, as required by the DPDP Act 2023. Bring your own
              key (BYOK) and your {label} controls it, not the platform.
            </p>

            <div className="flex items-center gap-2">
              {status === null ? (
                <span className="text-sm text-muted-foreground">Checking…</span>
              ) : ownKey ? (
                <>
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">Your own key</Badge>
                  <span className="text-sm text-muted-foreground">
                    Set {status.set_at ? new Date(status.set_at).toLocaleDateString() : ''}
                    {status.rotation_count > 0 ? ` · rotated ${status.rotation_count} time${status.rotation_count > 1 ? 's' : ''}` : ''}
                  </span>
                </>
              ) : (
                <>
                  <Badge variant="secondary">Platform key</Badge>
                  <span className="text-sm text-muted-foreground">
                    The platform's default key protects your data until you set your own.
                  </span>
                </>
              )}
            </div>

            <div className="space-y-1.5 max-w-md">
              <Label htmlFor="org-encryption-key">{ownKey ? 'Rotate your key' : 'Set your own key'}</Label>
              <Input
                id="org-encryption-key"
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={`Enter your key (min ${MIN_KEY_LENGTH} characters)`}
              />
              {key && key.length < MIN_KEY_LENGTH && (
                <p className="text-xs text-destructive">Key must be at least {MIN_KEY_LENGTH} characters.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => callKeyFunction('save')}
                disabled={!orgId || key.length < MIN_KEY_LENGTH || saving}
              >
                {saving ? 'Saving…' : ownKey ? 'Rotate key' : 'Save key'}
              </Button>
              {ownKey && (
                <Button variant="outline" onClick={() => setConfirmRemove(true)} disabled={saving}>
                  Go back to the platform key
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Saving a key re-encrypts your existing records under it straight away. Keep it somewhere safe: the
              platform never shows it again and cannot recover it. Your {label} keeps working normally if the key is
              lost, but the protected copy cannot be opened until a new key is set.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-4 w-4" /> Live proof of encryption
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              See real evidence, straight from the database, that your {label}'s {orgType === 'association' ? 'contact' : ''}{' '}
              email is stored encrypted. Handy to show an auditor.
            </p>
            <Button variant="outline" onClick={showProof} disabled={!orgId || proofLoading}>
              {proofLoading ? 'Loading…' : 'Show live proof'}
            </Button>

            {proof && (
              <div className="rounded-lg border divide-y text-sm">
                <div className="p-3 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1">
                  <span className="text-muted-foreground">What you see in the app</span>
                  <span className="font-medium break-all">{proof.real_value}</span>
                </div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1">
                  <span className="text-muted-foreground">What is actually stored</span>
                  <span className="font-mono text-xs break-all">{proof.stored_ciphertext_hex}</span>
                </div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1">
                  <span className="text-muted-foreground">Ciphertext size</span>
                  <span>{proof.ciphertext_bytes} bytes</span>
                </div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1">
                  <span className="text-muted-foreground">Protected by</span>
                  <span>{proof.key_source === 'own' ? 'Your own key' : 'The platform key'}</span>
                </div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1 items-center">
                  <span className="text-muted-foreground">Decrypts back correctly</span>
                  {proof.decrypts_correctly ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 w-fit">✓ Confirmed</Badge>
                  ) : (
                    <Badge variant="destructive" className="w-fit">Failed</Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Go back to the platform key?</AlertDialogTitle>
            <AlertDialogDescription>
              Your data will be re-encrypted under the platform's default key, and your own key will be deleted from
              the platform. This cannot be undone, but you can set a new key at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my key</AlertDialogCancel>
            <AlertDialogAction onClick={() => callKeyFunction('remove')}>Use the platform key</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
