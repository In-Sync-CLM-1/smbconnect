import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ChangePasswordForm } from '@/components/account/ChangePasswordForm';
import { EditEmailDialog } from '@/components/account/EditEmailDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { ShieldCheck, ChevronRight } from 'lucide-react';

export default function AccountSettings() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!loading && user) {
      fetchProfile();
    }
  }, [user, loading]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setProfile(data);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 !pl-20 md:!pl-24 max-w-4xl">
        <BackButton fallbackPath="/dashboard" variant="ghost" label="Back" className="mb-6" />

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Account Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account settings and preferences
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Your account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  {user?.email && <EditEmailDialog currentEmail={user.email} />}
                </div>
                <p className="text-base mt-1">{user?.email}</p>
              </div>
              {profile && (
                <>
                  {profile.first_name && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">First Name</label>
                      <p className="text-base mt-1">{profile.first_name}</p>
                    </div>
                  )}
                  {profile.last_name && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                      <p className="text-base mt-1">{profile.last_name}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <ChangePasswordForm />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Privacy &amp; My Data
              </CardTitle>
              <CardDescription>
                View your consent history and exercise your data-protection rights under the
                DPDP Act, 2023 — access, correct, or erase your data, or withdraw consent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate('/privacy-and-data')}>
                Manage Privacy &amp; My Data
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
