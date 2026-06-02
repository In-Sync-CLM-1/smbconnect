import { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BannerImage } from '@/components/ui/banner-image';
import { Camera, Image as ImageIcon, X } from 'lucide-react';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('India'),
  postal_code: z.string().optional(),
  year_established: z.string().optional(),
  industry_type: z.string().optional(),
  business_type: z.string().optional(),
  employee_count: z.string().optional(),
  gst_number: z.string().optional(),
  pan_number: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface EditCompanyProfileDialogProps {
  company: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditCompanyProfileDialog({
  company,
  open,
  onOpenChange,
  onSuccess,
}: EditCompanyProfileDialogProps) {
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(company.logo || null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(company.cover_image || null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Logo must be less than 5MB', variant: 'destructive' });
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Cover image must be less than 10MB', variant: 'destructive' });
      return;
    }

    setCoverFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file: File, type: 'logo' | 'cover'): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `company-${type}-${Date.now()}.${fileExt}`;
      // User-scoped folder in the shared public images bucket (same path as
      // association covers — authenticated users may write to their own folder).
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage.from('profile-images').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      toast({ title: 'Upload failed', description: `Failed to upload ${type}. Please try again.`, variant: 'destructive' });
      return null;
    }
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: company.name,
      description: company.description || '',
      email: company.email || '',
      phone: company.phone || '',
      website: company.website || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      country: company.country || 'India',
      postal_code: company.postal_code || '',
      year_established: company.year_established?.toString() || '',
      industry_type: company.industry_type || undefined,
      business_type: company.business_type || '',
      employee_count: company.employee_count?.toString() || '',
      gst_number: company.gst_number || '',
      pan_number: company.pan_number || '',
    },
  });

  useEffect(() => {
    if (!open) return;

    setLogoFile(null);
    setCoverFile(null);
    setLogoPreview(company.logo || null);
    setCoverPreview(company.cover_image || null);
    reset({
      name: company.name,
      description: company.description || '',
      email: company.email || '',
      phone: company.phone || '',
      website: company.website || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      country: company.country || 'India',
      postal_code: company.postal_code || '',
      year_established: company.year_established?.toString() || '',
      industry_type: company.industry_type || undefined,
      business_type: company.business_type || '',
      employee_count: company.employee_count?.toString() || '',
      gst_number: company.gst_number || '',
      pan_number: company.pan_number || '',
    });
  }, [open, company, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setLoading(true);

      const updates: Record<string, unknown> = {};

      if (logoFile) {
        const uploadedUrl = await uploadImage(logoFile, 'logo');
        if (uploadedUrl) {
          updates.logo = uploadedUrl;
        } else {
          setLoading(false);
          return;
        }
      }

      if (coverFile) {
        const uploadedUrl = await uploadImage(coverFile, 'cover');
        if (uploadedUrl) {
          updates.cover_image = uploadedUrl;
        } else {
          setLoading(false);
          return;
        }
      }

      const nextDescription = data.description || '';
      const nextPhone = data.phone || '';
      const nextWebsite = data.website || '';
      const nextAddress = data.address || '';
      const nextCity = data.city || '';
      const nextState = data.state || '';
      const nextCountry = data.country || 'India';
      const nextPostalCode = data.postal_code || '';
      const nextYearEstablished = data.year_established ? parseInt(data.year_established) : null;
      const nextIndustryType = data.industry_type || null;
      const nextBusinessType = data.business_type || null;
      const nextEmployeeCount = data.employee_count ? parseInt(data.employee_count) : null;
      const nextGst = data.gst_number || null;
      const nextPan = data.pan_number || null;

      if (data.name !== company.name) updates.name = data.name;
      if (nextDescription !== (company.description || '')) updates.description = nextDescription;
      if (data.email !== company.email) updates.email = data.email;
      if (nextPhone !== (company.phone || '')) updates.phone = nextPhone;
      if (nextWebsite !== (company.website || '')) updates.website = nextWebsite;
      if (nextAddress !== (company.address || '')) updates.address = nextAddress;
      if (nextCity !== (company.city || '')) updates.city = nextCity;
      if (nextState !== (company.state || '')) updates.state = nextState;
      if (nextCountry !== (company.country || 'India')) updates.country = nextCountry;
      if (nextPostalCode !== (company.postal_code || '')) updates.postal_code = nextPostalCode;
      if (nextYearEstablished !== (company.year_established ?? null)) updates.year_established = nextYearEstablished;
      if (nextIndustryType !== (company.industry_type || null)) updates.industry_type = nextIndustryType;
      if (nextBusinessType !== (company.business_type || null)) updates.business_type = nextBusinessType;
      if (nextEmployeeCount !== (company.employee_count ?? null)) updates.employee_count = nextEmployeeCount;
      if (nextGst !== (company.gst_number || null)) updates.gst_number = nextGst;
      if (nextPan !== (company.pan_number || null)) updates.pan_number = nextPan;

      if (Object.keys(updates).length === 0) {
        setLogoFile(null);
        setCoverFile(null);
        onOpenChange(false);
        return;
      }

      const { error } = await supabase
        .from('companies')
        .update(updates as any)
        .eq('id', company.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Profile updated successfully' });
      setLogoFile(null);
      setCoverFile(null);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update profile', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Company Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Tabs defaultValue="basic">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              {/* Cover Image Upload */}
              <div className="space-y-2">
                <Label>Cover Image</Label>
                <p className="text-xs text-muted-foreground mb-2">Any image works — the full banner is always shown. For the sharpest result, use a wide image around 1200 x 300 pixels.</p>
                <div
                  className="relative h-32 bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 rounded-lg overflow-hidden group cursor-pointer border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
                  onClick={() => coverInputRef.current?.click()}
                >
                  {coverPreview ? (
                    <BannerImage src={coverPreview} alt="Cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                        <span className="text-sm">Click to upload cover image</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
                <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
                {coverFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      setCoverFile(null);
                      setCoverPreview(company.cover_image || null);
                    }}
                  >
                    <X className="w-3 h-3 mr-1" /> Remove new cover
                  </Button>
                )}
              </div>

              {/* Logo Upload */}
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Avatar className="w-20 h-20 border-2 border-muted">
                    <AvatarImage src={logoPreview || undefined} />
                    <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                      {company.name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={loading}
                  >
                    <Camera className="w-5 h-5 text-white" />
                  </button>
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                </div>
                <div className="flex-1">
                  <Label>Logo</Label>
                  <p className="text-xs text-muted-foreground">Recommended: 200 x 200 pixels (1:1 ratio, max 5MB)</p>
                  {logoFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-destructive"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(company.logo || null);
                      }}
                    >
                      <X className="w-3 h-3 mr-1" /> Remove new logo
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="name">Name *</Label>
                <Input {...register('name')} id="name" disabled={loading} />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea {...register('description')} id="description" disabled={loading} rows={4} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="year_established">Year Established</Label>
                  <Input {...register('year_established')} id="year_established" type="number" placeholder="2020" disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="employee_count">Employee Count</Label>
                  <Input {...register('employee_count')} id="employee_count" type="number" placeholder="50" disabled={loading} />
                </div>
              </div>

              <div>
                <Label htmlFor="industry_type">Industry</Label>
                <Controller
                  name="industry_type"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={loading}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Agriculture & Allied Activities">Agriculture & Allied Activities</SelectItem>
                        <SelectItem value="Automobile & Auto Components">Automobile & Auto Components</SelectItem>
                        <SelectItem value="Aviation">Aviation</SelectItem>
                        <SelectItem value="Banking, Financial Services & Insurance (BFSI)">Banking, Financial Services & Insurance (BFSI)</SelectItem>
                        <SelectItem value="Biotechnology & Life Sciences">Biotechnology & Life Sciences</SelectItem>
                        <SelectItem value="Chemicals & Petrochemicals">Chemicals & Petrochemicals</SelectItem>
                        <SelectItem value="Construction & Real Estate">Construction & Real Estate</SelectItem>
                        <SelectItem value="Consumer Goods (FMCG & Consumer Durables)">Consumer Goods (FMCG & Consumer Durables)</SelectItem>
                        <SelectItem value="Defence & Aerospace">Defence & Aerospace</SelectItem>
                        <SelectItem value="Education & EdTech">Education & EdTech</SelectItem>
                        <SelectItem value="Electronics & Electricals">Electronics & Electricals</SelectItem>
                        <SelectItem value="Energy (Oil, Gas, Power, Renewables)">Energy (Oil, Gas, Power, Renewables)</SelectItem>
                        <SelectItem value="Engineering & Capital Goods">Engineering & Capital Goods</SelectItem>
                        <SelectItem value="Environmental Services & Waste Management">Environmental Services & Waste Management</SelectItem>
                        <SelectItem value="Food Processing & Beverages">Food Processing & Beverages</SelectItem>
                        <SelectItem value="Healthcare & Pharmaceuticals">Healthcare & Pharmaceuticals</SelectItem>
                        <SelectItem value="Hospitality & Tourism">Hospitality & Tourism</SelectItem>
                        <SelectItem value="Information Technology (IT) & ITES">Information Technology (IT) & ITES</SelectItem>
                        <SelectItem value="Infrastructure & Logistics">Infrastructure & Logistics</SelectItem>
                        <SelectItem value="Legal & Professional Services">Legal & Professional Services</SelectItem>
                        <SelectItem value="Manufacturing (General)">Manufacturing (General)</SelectItem>
                        <SelectItem value="Media, Entertainment & Publishing">Media, Entertainment & Publishing</SelectItem>
                        <SelectItem value="Metals & Mining">Metals & Mining</SelectItem>
                        <SelectItem value="Public Sector & Government">Public Sector & Government</SelectItem>
                        <SelectItem value="Retail & E-commerce">Retail & E-commerce</SelectItem>
                        <SelectItem value="Telecommunications">Telecommunications</SelectItem>
                        <SelectItem value="Textiles & Apparel">Textiles & Apparel</SelectItem>
                        <SelectItem value="Transport & Mobility">Transport & Mobility</SelectItem>
                        <SelectItem value="Water & Sanitation">Water & Sanitation</SelectItem>
                        <SelectItem value="Non-Profit & Social Enterprises">Non-Profit & Social Enterprises</SelectItem>
                        <SelectItem value="Startups & Emerging Businesses">Startups & Emerging Businesses</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label htmlFor="business_type">Business Type</Label>
                <Input {...register('business_type')} id="business_type" placeholder="e.g., Private Limited, LLP, Proprietorship" disabled={loading} />
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Contact Email *</Label>
                  <Input {...register('email')} id="email" type="email" disabled={loading} />
                  {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="phone">Contact Phone</Label>
                  <Input {...register('phone')} id="phone" type="tel" disabled={loading} />
                </div>
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input {...register('website')} id="website" type="url" placeholder="https://" disabled={loading} />
                {errors.website && <p className="text-sm text-destructive mt-1">{errors.website.message}</p>}
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input {...register('address')} id="address" disabled={loading} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input {...register('city')} id="city" disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input {...register('state')} id="state" disabled={loading} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input {...register('country')} id="country" disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input {...register('postal_code')} id="postal_code" disabled={loading} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gst_number">GST Number</Label>
                  <Input {...register('gst_number')} id="gst_number" disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="pan_number">PAN Number</Label>
                  <Input {...register('pan_number')} id="pan_number" disabled={loading} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
