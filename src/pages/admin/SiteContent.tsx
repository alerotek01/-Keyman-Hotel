import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSiteSettings, useUpdateSiteSetting } from '@/hooks/useCms';
import { usePageContent, useUpdatePageContent } from '@/hooks/useCms';
import { useHeroSlides, useCreateHeroSlide, useUpdateHeroSlide, useDeleteHeroSlide, useUploadHeroSlideImage } from '@/hooks/useCms';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Globe, FileText, ImagePlus, Trash2, GripVertical } from 'lucide-react';

export default function AdminSiteContent() {
  const { data: settings, isLoading: settingsLoading } = useSiteSettings();
  const { data: pageContent, isLoading: contentLoading } = usePageContent();
  const { data: heroSlides, isLoading: slidesLoading } = useHeroSlides();
  const updateSetting = useUpdateSiteSetting();
  const updateContent = useUpdatePageContent();
  const createSlide = useCreateHeroSlide();
  const updateSlide = useUpdateHeroSlide();
  const deleteSlide = useDeleteHeroSlide();
  const uploadSlideImage = useUploadHeroSlideImage();
  const { toast } = useToast();

  // Local state for settings form
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [settingsDirty, setSettingsDirty] = useState(false);

  // Hero slide dialog
  const [slideDialogOpen, setSlideDialogOpen] = useState(false);
  const [slideForm, setSlideForm] = useState({ caption: '', alt_text: '' });
  const [slideFile, setSlideFile] = useState<File | null>(null);

  const isLoading = settingsLoading || contentLoading || slidesLoading;

  // Initialize settings form from data
  const getSetting = (key: string): string => {
    if (settingsForm[key] !== undefined) return settingsForm[key];
    return settings?.find(s => s.key === key)?.value || '';
  };

  const setSetting = (key: string, value: string) => {
    setSettingsForm(prev => ({ ...prev, [key]: value }));
    setSettingsDirty(true);
  };

  const handleSaveSettings = async () => {
    try {
      const entries = Object.entries(settingsForm).filter(([_, v]) => v !== undefined);
      for (const [key, value] of entries) {
        await updateSetting.mutateAsync({ key, value });
      }
      setSettingsDirty(false);
      toast({ title: 'Settings Saved', description: 'Site settings updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveContent = async (id: string, field: string, value: string) => {
    try {
      await updateContent.mutateAsync({ id, [field]: value });
      toast({ title: 'Content Updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideFile) { toast({ title: 'Please select an image', variant: 'destructive' }); return; }
    try {
      // Create slide first with placeholder
      const { data: slide, error } = await (await import('@/integrations/supabase/client')).supabase
        .from('hero_slides')
        .insert({
          image_url: '',
          caption: slideForm.caption || undefined,
          alt_text: slideForm.alt_text || undefined,
          sort_order: heroSlides?.length || 0,
        })
        .select()
        .single();
      if (error) throw error;

      // Upload image
      await uploadSlideImage.mutateAsync({ slideId: slide.id, file: slideFile });

      setSlideDialogOpen(false);
      setSlideForm({ caption: '', alt_text: '' });
      setSlideFile(null);
      toast({ title: 'Slide Added' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateSlide = async (id: string, field: string, value: string) => {
    try {
      await updateSlide.mutateAsync({ id, [field]: value });
      toast({ title: 'Slide Updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteSlide = async (id: string) => {
    if (!confirm('Delete this hero slide?')) return;
    try {
      await deleteSlide.mutateAsync(id);
      toast({ title: 'Slide Deleted' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  // Group page content by page
  const contentByPage = (pageContent || []).reduce((acc, item) => {
    if (!acc[item.page]) acc[item.page] = [];
    acc[item.page].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Site Content</h1>
          <p className="text-muted-foreground">Manage hotel info, page content, and hero images</p>
        </div>
        {settingsDirty && (
          <Button variant="brass" onClick={handleSaveSettings} disabled={updateSetting.isPending}>
            {updateSetting.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        )}
      </div>

      <Tabs defaultValue="hotel" className="space-y-6">
        <TabsList>
          <TabsTrigger value="hotel" className="gap-2"><Globe className="h-4 w-4" /> Hotel Info</TabsTrigger>
          <TabsTrigger value="content" className="gap-2"><FileText className="h-4 w-4" /> Page Content</TabsTrigger>
          <TabsTrigger value="hero" className="gap-2"><ImagePlus className="h-4 w-4" /> Hero Slides</TabsTrigger>
        </TabsList>

        {/* ===== HOTEL INFO TAB ===== */}
        <TabsContent value="hotel" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Hotel Information</CardTitle>
              <CardDescription>Basic contact and branding info displayed across the site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hotel Name</Label>
                  <Input value={getSetting('hotel_name')} onChange={(e) => setSetting('hotel_name', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={getSetting('phone')} onChange={(e) => setSetting('phone', e.target.value)} placeholder="+254 700 000 000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={getSetting('hotel_email')} onChange={(e) => setSetting('hotel_email', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={getSetting('hotel_address')} onChange={(e) => setSetting('hotel_address', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input value={getSetting('tagline')} onChange={(e) => setSetting('tagline', e.target.value)} placeholder="Rooms with views of the Taita Hills" />
                </div>
                <div className="space-y-2">
                  <Label>Operating Hours</Label>
                  <Input value={getSetting('operating_hours')} onChange={(e) => setSetting('operating_hours', e.target.value)} placeholder="24/7 Front Desk" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Check-in Time</Label>
                  <Input value={getSetting('check_in_time')} onChange={(e) => setSetting('check_in_time', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Check-out Time</Label>
                  <Input value={getSetting('check_out_time')} onChange={(e) => setSetting('check_out_time', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input value={getSetting('currency')} onChange={(e) => setSetting('currency', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>VAT Rate (%)</Label>
                  <Input type="number" value={getSetting('vat_rate')} onChange={(e) => setSetting('vat_rate', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PAGE CONTENT TAB ===== */}
        <TabsContent value="content" className="space-y-6">
          {Object.entries(contentByPage).map(([page, items]) => (
            <Card key={page}>
              <CardHeader>
                <CardTitle className="capitalize">{page} Page</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge variant="outline" className="text-xs">{item.section}</Badge>
                        {item.heading && <span className="ml-2 font-medium">{item.heading}</span>}
                      </div>
                    </div>
                    {item.heading !== undefined && (
                      <div className="space-y-2">
                        <Label className="text-xs">Heading</Label>
                        <Input
                          defaultValue={item.heading}
                          onBlur={(e) => handleSaveContent(item.id, 'heading', e.target.value)}
                        />
                      </div>
                    )}
                    {item.subheading !== undefined && (
                      <div className="space-y-2">
                        <Label className="text-xs">Subheading</Label>
                        <Input
                          defaultValue={item.subheading}
                          onBlur={(e) => handleSaveContent(item.id, 'subheading', e.target.value)}
                        />
                      </div>
                    )}
                    {item.body !== undefined && (
                      <div className="space-y-2">
                        <Label className="text-xs">Body</Label>
                        <Textarea
                          defaultValue={item.body}
                          rows={3}
                          onBlur={(e) => handleSaveContent(item.id, 'body', e.target.value)}
                        />
                      </div>
                    )}
                    {item.cta_text !== undefined && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">CTA Text</Label>
                          <Input
                            defaultValue={item.cta_text}
                            onBlur={(e) => handleSaveContent(item.id, 'cta_text', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">CTA Link</Label>
                          <Input
                            defaultValue={item.cta_link}
                            onBlur={(e) => handleSaveContent(item.id, 'cta_link', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {Object.keys(contentByPage).length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No page content yet</p>
            </div>
          )}
        </TabsContent>

        {/* ===== HERO SLIDES TAB ===== */}
        <TabsContent value="hero" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={slideDialogOpen} onOpenChange={setSlideDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="brass">
                  <ImagePlus className="mr-2 h-4 w-4" /> Add Slide
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Hero Slide</DialogTitle>
                  <DialogDescription>Upload an image and add a caption for the hero carousel.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddSlide} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Image</Label>
                    <input
                      type="file"
                      accept="image/*"
                      className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brass file:text-white hover:file:bg-brass/90"
                      onChange={(e) => setSlideFile(e.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Caption</Label>
                    <Input
                      value={slideForm.caption}
                      onChange={(e) => setSlideForm({ ...slideForm, caption: e.target.value })}
                      placeholder="Text overlay on the image"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Alt Text</Label>
                    <Input
                      value={slideForm.alt_text}
                      onChange={(e) => setSlideForm({ ...slideForm, alt_text: e.target.value })}
                      placeholder="Accessibility description"
                    />
                  </div>
                  <Button type="submit" variant="brass" className="w-full" disabled={createSlide.isPending}>
                    {createSlide.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Slide
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {heroSlides?.map((slide, idx) => (
              <Card key={slide.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                    <span className="text-sm font-mono">{idx + 1}</span>
                  </div>
                  <label className="relative cursor-pointer group">
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        await uploadSlideImage.mutateAsync({ slideId: slide.id, file: f });
                        toast({ title: 'Image updated' });
                      } catch (err: any) { toast({ title: 'Upload failed', variant: 'destructive' }); }
                    }} />
                    <img src={slide.image_url} alt={slide.alt_text || 'Hero slide'} className="h-20 w-36 object-cover rounded-lg group-hover:opacity-80 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-medium">Change</span>
                    </div>
                  </label>
                  <div className="flex-1 space-y-1">
                    <Input
                      defaultValue={slide.caption || ''}
                      placeholder="Caption"
                      className="text-sm h-8"
                      onBlur={(e) => handleUpdateSlide(slide.id, 'caption', e.target.value)}
                    />
                    <Input
                      defaultValue={slide.alt_text || ''}
                      placeholder="Alt text"
                      className="text-xs h-7 text-muted-foreground"
                      onBlur={(e) => handleUpdateSlide(slide.id, 'alt_text', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${slide.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                      {slide.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteSlide(slide.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {(!heroSlides || heroSlides.length === 0) && (
            <div className="text-center py-12">
              <ImagePlus className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No hero slides yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
