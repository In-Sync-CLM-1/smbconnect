import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, Clock, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { DATA_REQUEST_TYPES, DATA_REQUEST_TYPE_LABELS, GRIEVANCE_EMAIL } from '@/lib/dpdp';

export default function PrivacyAndData() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [consents, setConsents] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [requestType, setRequestType] = useState<string>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) loadAll();
  }, [authLoading, user]);

  const loadAll = async () => {
    try {
      setLoadingData(true);
      const [{ data: consentData }, { data: requestData }, { data: profile }] = await Promise.all([
        supabase.from('consent_records').select('*').order('consented_at', { ascending: false }),
        supabase.from('data_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('first_name, last_name').eq('id', user!.id).maybeSingle(),
      ]);
      setConsents(consentData || []);
      setRequests(requestData || []);
      if (profile) setProfileName([profile.first_name, profile.last_name].filter(Boolean).join(' ') || null);
    } catch (error: any) {
      console.error('Error loading privacy data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const submitRequest = async () => {
    if (!user || !requestType) return;
    try {
      setSubmitting(true);
      const { error } = await supabase.from('data_requests').insert([{
        user_id: user.id,
        user_email: user.email,
        user_name: profileName,
        request_type: requestType,
        details: details || null,
        status: 'pending',
      }]);
      if (error) throw error;
      toast({
        title: 'Request submitted',
        description: 'Our team will action your request and update its status here.',
      });
      setRequestType('');
      setDetails('');
      loadAll();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to submit request', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'in_progress':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
      case 'completed':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto py-4 max-w-4xl flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Privacy &amp; My Data</h1>
              <p className="text-sm text-muted-foreground">
                Your data-protection rights under the DPDP Act, 2023
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-6 max-w-4xl space-y-6">
        {/* Raise a request */}
        <Card>
          <CardHeader>
            <CardTitle>Exercise your rights</CardTitle>
            <CardDescription>
              Request access to, correction of, or erasure of your personal data, or withdraw your
              consent. We aim to action requests within 30 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="request_type">What would you like to do?</Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger id="request_type">
                  <SelectValue placeholder="Select a request type" />
                </SelectTrigger>
                <SelectContent>
                  {DATA_REQUEST_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {requestType && (
                <p className="text-sm text-muted-foreground mt-1">
                  {DATA_REQUEST_TYPES.find((t) => t.value === requestType)?.description}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="details">Additional details (optional)</Label>
              <Textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Tell us anything that will help us action your request."
              />
            </div>
            <Button onClick={submitRequest} disabled={!requestType || submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </CardContent>
        </Card>

        {/* My requests */}
        <Card>
          <CardHeader>
            <CardTitle>My requests</CardTitle>
            <CardDescription>Track the status of requests you have raised.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingData ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven't raised any requests yet.</p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">{DATA_REQUEST_TYPE_LABELS[r.request_type] || r.request_type}</div>
                    {r.details && <div className="text-sm text-muted-foreground">{r.details}</div>}
                    <div className="text-xs text-muted-foreground">
                      Raised {new Date(r.created_at).toLocaleDateString()}
                    </div>
                    {r.admin_notes && (
                      <div className="text-sm mt-1 p-2 bg-muted rounded"><strong>Response:</strong> {r.admin_notes}</div>
                    )}
                  </div>
                  <div>{statusBadge(r.status)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Consent history */}
        <Card>
          <CardHeader>
            <CardTitle>My consent history</CardTitle>
            <CardDescription>A record of the consents you have given.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingData ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : consents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No consent records found.</p>
            ) : (
              consents.map((c) => (
                <div key={c.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium capitalize">{String(c.purpose).replace(/_/g, ' ')}</div>
                    <div className="text-xs text-muted-foreground">
                      Given {new Date(c.consented_at).toLocaleDateString()} · Notice v{c.consent_version}
                    </div>
                  </div>
                  {c.withdrawn_at ? (
                    <Badge variant="destructive">Withdrawn</Badge>
                  ) : (
                    <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center">
          Questions about your data? Contact our Grievance Officer at{' '}
          <a href={`mailto:${GRIEVANCE_EMAIL}`} className="text-primary hover:underline">{GRIEVANCE_EMAIL}</a>.
        </p>
      </main>
    </div>
  );
}
