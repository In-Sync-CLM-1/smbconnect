import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackButton } from '@/components/BackButton';
import { Shield, ShieldAlert, AlertTriangle, Download, Eye, CheckCircle } from 'lucide-react';
import { DATA_REQUEST_TYPE_LABELS, GRIEVANCE_EMAIL } from '@/lib/dpdp';

const REQUEST_STATUSES = ['pending', 'in_progress', 'completed', 'rejected'];

export default function AdminDpdp() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<any[]>([]);
  const [breaches, setBreaches] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const [breachForm, setBreachForm] = useState({
    title: '', description: '', impact: '', remedial_steps: '', contact_info: GRIEVANCE_EMAIL,
  });
  const [submittingBreach, setSubmittingBreach] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [{ data: reqs }, { data: brs }, { data: lgs }] = await Promise.all([
        supabase.from('data_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('breach_notifications').select('*').order('triggered_at', { ascending: false }),
        supabase.from('pii_access_log').select('*').order('accessed_at', { ascending: false }).limit(500),
      ]);
      setRequests(reqs || []);
      setBreaches(brs || []);
      setLogs(lgs || []);
    } catch (error: any) {
      console.error('Error loading DPDP data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRequest = async (id: string, status: string) => {
    try {
      const updates: any = { status, admin_notes: notesById[id] ?? undefined };
      if (status === 'completed') updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from('data_requests').update(updates).eq('id', id);
      if (error) throw error;
      toast({ title: 'Request updated', description: `Marked as ${status.replace('_', ' ')}.` });
      loadAll();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const submitBreach = async () => {
    if (!user) return;
    try {
      setSubmittingBreach(true);
      const { error } = await supabase.from('breach_notifications').insert([{
        ...breachForm,
        triggered_by: user.id,
        triggered_by_email: user.email,
        affected_user_ids: [],
      }]);
      if (error) throw error;
      toast({ title: 'Breach recorded', description: 'The breach notification has been logged.' });
      setBreachForm({ title: '', description: '', impact: '', remedial_steps: '', contact_info: GRIEVANCE_EMAIL });
      loadAll();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmittingBreach(false);
    }
  };

  const exportLogsCsv = () => {
    if (!logs.length) return;
    const headers = ['Accessed At', 'Accessor', 'Table', 'Column', 'Subject', 'Purpose'];
    const rows = logs.map((l) => [
      new Date(l.accessed_at).toISOString(),
      l.accessor_email || l.user_id,
      l.table_name,
      l.column_name || '',
      l.subject_label || l.subject_id || '',
      l.purpose,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => (String(v).includes(',') ? `"${v}"` : v)).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dpdp-pii-access-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, any> = { pending: 'outline', in_progress: 'secondary', completed: 'default', rejected: 'destructive' };
    return <Badge variant={map[status] || 'secondary'}>{status.replace('_', ' ')}</Badge>;
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 !pl-20 md:!pl-24 max-w-5xl">
        <BackButton fallbackPath="/admin" variant="ghost" label="Back to Admin" className="mb-6" />

        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">DPDP Compliance</h1>
            <p className="text-muted-foreground">
              Data-principal requests, breach notifications, and PII access audit (DPDP Act, 2023)
            </p>
          </div>
        </div>

        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">
              Data Requests{pendingCount > 0 && <Badge className="ml-2">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="breaches">Breach Notifications</TabsTrigger>
            <TabsTrigger value="audit">PII Access Log</TabsTrigger>
          </TabsList>

          {/* ---- Data requests ---- */}
          <TabsContent value="requests" className="space-y-3 mt-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data requests yet.</p>
            ) : (
              requests.map((r) => {
                const overdue = r.status === 'pending' && new Date(r.due_date) < new Date();
                return (
                  <Card key={r.id} className={overdue ? 'border-destructive' : ''}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{DATA_REQUEST_TYPE_LABELS[r.request_type] || r.request_type}</p>
                          <p className="text-xs text-muted-foreground">{r.user_name || ''} {r.user_email}</p>
                        </div>
                        {statusBadge(r.status)}
                      </div>
                      {r.details && <p className="text-sm">{r.details}</p>}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span>Raised: {new Date(r.created_at).toLocaleDateString()}</span>
                        <span className={overdue ? 'text-destructive font-semibold' : ''}>
                          {overdue && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                          Due: {new Date(r.due_date).toLocaleDateString()}
                        </span>
                      </div>
                      {r.status !== 'completed' && r.status !== 'rejected' && (
                        <div className="space-y-2 pt-1">
                          <Textarea
                            placeholder="Response / notes to the requester (optional)"
                            value={notesById[r.id] ?? r.admin_notes ?? ''}
                            onChange={(e) => setNotesById((p) => ({ ...p, [r.id]: e.target.value }))}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            {r.status === 'pending' && (
                              <Button size="sm" variant="outline" onClick={() => updateRequest(r.id, 'in_progress')}>
                                Mark In Progress
                              </Button>
                            )}
                            <Button size="sm" onClick={() => updateRequest(r.id, 'completed')}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Complete
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => updateRequest(r.id, 'rejected')}>
                              Reject
                            </Button>
                          </div>
                        </div>
                      )}
                      {r.admin_notes && (r.status === 'completed' || r.status === 'rejected') && (
                        <div className="text-sm p-2 bg-muted rounded"><strong>Response:</strong> {r.admin_notes}</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ---- Breach notifications ---- */}
          <TabsContent value="breaches" className="space-y-4 mt-4">
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" /> Record a Data Breach
                </CardTitle>
                <CardDescription>
                  Per the DPDP Act 2023, breach notifications must be in clear, plain language.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div><Label>Title *</Label><Input value={breachForm.title} onChange={(e) => setBreachForm((p) => ({ ...p, title: e.target.value }))} placeholder="Brief title of the breach" /></div>
                <div><Label>What happened *</Label><Textarea value={breachForm.description} onChange={(e) => setBreachForm((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Describe the breach in plain language" /></div>
                <div><Label>Impact on data principals *</Label><Textarea value={breachForm.impact} onChange={(e) => setBreachForm((p) => ({ ...p, impact: e.target.value }))} rows={2} placeholder="What data was affected and how it may impact members" /></div>
                <div><Label>Remedial steps taken *</Label><Textarea value={breachForm.remedial_steps} onChange={(e) => setBreachForm((p) => ({ ...p, remedial_steps: e.target.value }))} rows={2} placeholder="Steps taken to contain and prevent recurrence" /></div>
                <div><Label>Contact for queries *</Label><Input value={breachForm.contact_info} onChange={(e) => setBreachForm((p) => ({ ...p, contact_info: e.target.value }))} /></div>
                <Button
                  variant="destructive"
                  onClick={submitBreach}
                  disabled={submittingBreach || !breachForm.title || !breachForm.description || !breachForm.impact || !breachForm.remedial_steps}
                >
                  {submittingBreach ? 'Submitting…' : 'Submit Breach Report'}
                </Button>
              </CardContent>
            </Card>

            <h3 className="font-semibold text-sm">Past breach notifications</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : breaches.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" /> No breach notifications recorded.
              </p>
            ) : (
              breaches.map((b) => (
                <Card key={b.id}>
                  <CardContent className="p-4 space-y-1">
                    <p className="font-semibold">{b.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(b.triggered_at).toLocaleString()}</p>
                    <p className="text-sm">{b.description}</p>
                    <p className="text-sm text-muted-foreground"><strong>Impact:</strong> {b.impact}</p>
                    <p className="text-sm text-muted-foreground"><strong>Remedial steps:</strong> {b.remedial_steps}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ---- PII access audit ---- */}
          <TabsContent value="audit" className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Eye className="h-4 w-4" /> Showing the latest {logs.length} access events
              </p>
              <Button size="sm" variant="outline" onClick={exportLogsCsv} disabled={!logs.length}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground text-left">
                      <th className="py-2 px-3 font-medium">When</th>
                      <th className="py-2 px-3 font-medium">Accessor</th>
                      <th className="py-2 px-3 font-medium hidden md:table-cell">Table</th>
                      <th className="py-2 px-3 font-medium hidden md:table-cell">Field</th>
                      <th className="py-2 px-3 font-medium">Subject</th>
                      <th className="py-2 px-3 font-medium">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-3 whitespace-nowrap text-xs">{new Date(l.accessed_at).toLocaleString()}</td>
                        <td className="py-2 px-3">{l.accessor_email || String(l.user_id).slice(0, 8) + '…'}</td>
                        <td className="py-2 px-3 hidden md:table-cell font-mono text-xs">{l.table_name}</td>
                        <td className="py-2 px-3 hidden md:table-cell font-mono text-xs">{l.column_name || '-'}</td>
                        <td className="py-2 px-3 text-xs">{l.subject_label || (l.subject_id ? String(l.subject_id).slice(0, 8) + '…' : '-')}</td>
                        <td className="py-2 px-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{l.purpose}</span></td>
                      </tr>
                    ))}
                    {!loading && logs.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No PII access events logged yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
