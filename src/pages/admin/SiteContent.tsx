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
import { useCarouselSections, useUpdateCarouselSections, useUploadCarouselImage, type CarouselSection, type CarouselImage } from '@/hooks/useCms';
import { useConferenceMedia, useUpdateConferenceMedia, useUploadConferenceImage, type ConferenceMedia } from '@/hooks/useCms';

const DEFAULT_CONFERENCE_MEDIA: ConferenceMedia = { hero_image: '', carousel_images: [], video_url: '', video_poster: '', video_caption: 'Video walkthrough of our conference hall setup' };
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Globe, FileText, ImagePlus, Trash2, GripVertical, ChevronUp, ChevronDown, Eye, EyeOff, Plus, Images, Video } from 'lucide-react';

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

  // Hero slide create dialog
  const [slideDialogOpen, setSlideDialogOpen] = useState(false);
  const [slideForm, setSlideForm] = useState({ caption: '', alt_text: '', link_url: '', icon: '' });
  const [slideFile, setSlideFile] = useState<File | null>(null);

  // Hero slide edit dialog
  const [editSlideOpen, setEditSlideOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<any>(null);
  const [editForm, setEditForm] = useState({ caption: '', alt_text: '', link_url: '', icon: '' });
  const [editFile, setEditFile] = useState<File | null>(null);

  // Carousel sections
  const { data: carouselSections, isLoading: carouselLoading } = useCarouselSections();
  const updateCarousels = useUpdateCarouselSections();
  const uploadCarouselImage = useUploadCarouselImage();
  const [editingSection, setEditingSection] = useState<CarouselSection | null>(null);
  const [sectionForm, setSectionForm] = useState<{ eyebrow: string; title: string; caption: string; link: string; linkText: string }>({ eyebrow: '', title: '', caption: '', link: '', linkText: '' });
  const [carouselUploadFile, setCarouselUploadFile] = useState<File | null>(null);
  const [carouselSaving, setCarouselSaving] = useState(false);

  // Conference media
  const { data: confMedia, isLoading: confMediaLoading } = useConferenceMedia();
  const updateConfMedia = useUpdateConferenceMedia();
  const uploadConfImage = useUploadConferenceImage();
  const [confMediaForm, setConfMediaForm] = useState<ConferenceMedia>(DEFAULT_CONFERENCE_MEDIA);
  const [confMediaLoaded, setConfMediaLoaded] = useState(false);
  const [confSaving, setConfSaving] = useState(false);

  // Initialize conference media form from data
  if (confMedia && !confMediaLoaded) {
    setConfMediaForm(confMedia);
    setConfMediaLoaded(true);
  }

  const handleSaveConfMedia = async () => {
    setConfSaving(true);
    try {
      await updateConfMedia.mutateAsync(confMediaForm);
      toast({ title: 'Conference media saved' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setConfSaving(false);
  };

  const handleUploadConfImage = async (folder: string, field: 'hero_image' | 'video_poster') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setConfSaving(true);
      try {
        const url = await uploadConfImage.mutateAsync({ folder, file });
        setConfMediaForm(prev => ({ ...prev, [field]: url }));
        toast({ title: 'Image uploaded' });
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
      setConfSaving(false);
    };
    input.click();
  };

  const handleUploadConfCarouselImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setConfSaving(true);
      try {
        const url = await uploadConfImage.mutateAsync({ folder: 'carousel', file });
        const newImage: CarouselImage = { src: url, alt: file.name.replace(/\.[^.]+$/, '') };
        setConfMediaForm(prev => ({ ...prev, carousel_images: [...prev.carousel_images, newImage] }));
        toast({ title: 'Image added' });
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
      setConfSaving(false);
    };
    input.click();
  };

  const handleUploadConfVideo = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setConfSaving(true);
      try {
        const url = await uploadConfImage.mutateAsync({ folder: 'video', file });
        setConfMediaForm(prev => ({ ...prev, video_url: url }));
        toast({ title: 'Video uploaded' });
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
      setConfSaving(false);
    };
    input.click();
  };

  const handleRemoveConfCarouselImage = (idx: number) => {
    setConfMediaForm(prev => ({ ...prev, carousel_images: prev.carousel_images.filter((_, i) => i !== idx) }));
  };

  const handleMoveConfImage = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= confMediaForm.carousel_images.length) return;
    const images = [...confMediaForm.carousel_images];
    [images[idx], images[newIdx]] = [images[newIdx], images[idx]];
    setConfMediaForm(prev => ({ ...prev, carousel_images: images }));
  };

  const openEditSlide = (slide: any) => {
    setEditingSlide(slide);
    setEditForm({ caption: slide.caption || '', alt_text: slide.alt_text || '', link_url: slide.link_url || '', icon: slide.icon || '' });
    setEditFile(null);
    setEditSlideOpen(true);
  };

  const handleSaveEditSlide = async () => {
    if (!editingSlide) return;
    try {
      // Upload new image if selected
      if (editFile) {
        await uploadSlideImage.mutateAsync({ slideId: editingSlide.id, file: editFile });
      }
      // Update fields
      await updateSlide.mutateAsync({
        id: editingSlide.id,
        caption: editForm.caption,
        alt_text: editForm.alt_text,
        link_url: editForm.link_url || null,
        icon: editForm.icon || null,
      });
      setEditSlideOpen(false);
      toast({ title: 'Slide updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const isLoading = settingsLoading || contentLoading || slidesLoading || carouselLoading;

  // Carousel handlers
  const openSectionEditor = (section: CarouselSection) => {
    setEditingSection(section);
    setSectionForm({ eyebrow: section.eyebrow, title: section.title, caption: section.caption, link: section.link, linkText: section.linkText });
    setCarouselUploadFile(null);
  };

  const handleSaveSectionText = async () => {
    if (!editingSection || !carouselSections) return;
    setCarouselSaving(true);
    try {
      const updated = carouselSections.map(s =>
        s.id === editingSection.id ? { ...s, ...sectionForm } : s
      );
      await updateCarousels.mutateAsync(updated);
      setEditingSection(null);
      toast({ title: 'Section updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setCarouselSaving(false);
  };

  const handleUploadCarouselImage = async () => {
    if (!editingSection || !carouselUploadFile || !carouselSections) return;
    setCarouselSaving(true);
    try {
      const url = await uploadCarouselImage.mutateAsync({ sectionId: editingSection.id, file: carouselUploadFile });
      const newImage: CarouselImage = { src: url, alt: carouselUploadFile.name.replace(/\.[^.]+$/, '') };
      const updated = carouselSections.map(s =>
        s.id === editingSection.id ? { ...s, images: [...s.images, newImage] } : s
      );
      await updateCarousels.mutateAsync(updated);
      // Refresh local editing section
      const refreshed = updated.find(s => s.id === editingSection.id);
      if (refreshed) setEditingSection(refreshed);
      setCarouselUploadFile(null);
      toast({ title: 'Image added' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setCarouselSaving(false);
  };

  const handleRemoveCarouselImage = async (imageIndex: number) => {
    if (!editingSection || !carouselSections) return;
    setCarouselSaving(true);
    try {
      const updated = carouselSections.map(s =>
        s.id === editingSection.id ? { ...s, images: s.images.filter((_, i) => i !== imageIndex) } : s
      );
      await updateCarousels.mutateAsync(updated);
      const refreshed = updated.find(s => s.id === editingSection.id);
      if (refreshed) setEditingSection(refreshed);
      toast({ title: 'Image removed' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setCarouselSaving(false);
  };

  const handleUpdateImageAlt = async (imageIndex: number, newAlt: string) => {
    if (!editingSection || !carouselSections) return;
    try {
      const updated = carouselSections.map(s => {
        if (s.id !== editingSection.id) return s;
        const images = [...s.images];
        images[imageIndex] = { ...images[imageIndex], alt: newAlt };
        return { ...s, images };
      });
      await updateCarousels.mutateAsync(updated);
      const refreshed = updated.find(s => s.id === editingSection.id);
      if (refreshed) setEditingSection(refreshed);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleMoveImage = async (imageIndex: number, direction: -1 | 1) => {
    if (!editingSection || !carouselSections) return;
    const newIndex = imageIndex + direction;
    if (newIndex < 0 || newIndex >= editingSection.images.length) return;
    try {
      const updated = carouselSections.map(s => {
        if (s.id !== editingSection.id) return s;
        const images = [...s.images];
        [images[imageIndex], images[newIndex]] = [images[newIndex], images[imageIndex]];
        return { ...s, images };
      });
      await updateCarousels.mutateAsync(updated);
      const refreshed = updated.find(s => s.id === editingSection.id);
      if (refreshed) setEditingSection(refreshed);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

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
          link_url: slideForm.link_url || undefined,
          icon: slideForm.icon || undefined,
          sort_order: heroSlides?.length || 0,
        })
        .select()
        .single();
      if (error) throw error;

      // Upload image
      await uploadSlideImage.mutateAsync({ slideId: slide.id, file: slideFile });

      setSlideDialogOpen(false);
      setSlideForm({ caption: '', alt_text: '', link_url: '', icon: '' });
      setSlideFile(null);
      toast({ title: 'Slide Added' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateSlide = async (id: string, field: string, value: string) => {
    try {
      // Convert string booleans for is_active field
      const update: Record<string, unknown> = { id };
      if (field === 'is_active') {
        update[field] = value === 'true';
      } else {
        update[field] = value;
      }
      await updateSlide.mutateAsync(update);
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
          <TabsTrigger value="carousels" className="gap-2"><Images className="h-4 w-4" /> Carousels</TabsTrigger>
          <TabsTrigger value="conference" className="gap-2"><Video className="h-4 w-4" /> Conference</TabsTrigger>
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
                  <div className="space-y-2">
                    <Label>Link URL (optional)</Label>
                    <Input
                      value={slideForm.link_url}
                      onChange={(e) => setSlideForm({ ...slideForm, link_url: e.target.value })}
                      placeholder="/rooms or https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Icon (optional)</Label>
                    <Input
                      value={slideForm.icon}
                      onChange={(e) => setSlideForm({ ...slideForm, icon: e.target.value })}
                      placeholder="e.g. BedDouble, UtensilsCrossed, Sparkles"
                    />
                    <p className="text-[10px] text-muted-foreground">Lucide icon name — shown on the public site</p>
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
              <Card
                key={slide.id}
                className={`cursor-pointer transition-all hover:ring-2 hover:ring-brass/50 ${slide.is_active ? '' : 'opacity-60'}`}
                onClick={() => openEditSlide(slide)}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  {/* Order controls */}
                  <div className="flex flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <span className="text-sm font-mono text-muted-foreground">{idx + 1}</span>
                    <div className="flex flex-col -space-y-1">
                      <button
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        disabled={idx === 0}
                        onClick={async () => {
                          if (idx === 0) return;
                          const prev = heroSlides[idx - 1];
                          await updateSlide.mutateAsync({ id: prev.id, sort_order: slide.sort_order });
                          await updateSlide.mutateAsync({ id: slide.id, sort_order: prev.sort_order });
                        }}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        disabled={idx === heroSlides.length - 1}
                        onClick={async () => {
                          if (idx === heroSlides.length - 1) return;
                          const next = heroSlides[idx + 1];
                          await updateSlide.mutateAsync({ id: next.id, sort_order: slide.sort_order });
                          await updateSlide.mutateAsync({ id: slide.id, sort_order: next.sort_order });
                        }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Image preview */}
                  <img src={slide.image_url} alt={slide.alt_text || 'Hero slide'} className="h-20 w-36 object-cover rounded-lg shrink-0" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{slide.caption || 'No caption'}</p>
                    <p className="text-xs text-muted-foreground truncate">{slide.alt_text || 'No alt text'}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {slide.link_url && <p className="text-xs text-brass truncate">Link: {slide.link_url}</p>}
                      {slide.icon && <p className="text-xs text-purple-600 truncate">Icon: {slide.icon}</p>}
                    </div>
                  </div>

                  {/* Status + Actions */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleUpdateSlide(slide.id, 'is_active', String(!slide.is_active))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        slide.is_active
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {slide.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {slide.is_active ? 'Active' : 'Inactive'}
                    </button>
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

        {/* ===== CAROUSELS TAB ===== */}
        <TabsContent value="carousels" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Manage the image carousels shown on the homepage under "What We Offer". Each section has a title, caption, and rotating images.
          </p>

          <div className="grid gap-4">
            {carouselSections?.map((section) => (
              <Card key={section.id} className="cursor-pointer transition-all hover:ring-2 hover:ring-brass/50">
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    {/* Preview thumbnails */}
                    <div className="flex gap-1 shrink-0">
                      {section.images.slice(0, 3).map((img, i) => (
                        <div key={i} className="w-16 h-12 rounded overflow-hidden bg-muted">
                          {img.src && !img.src.includes('placeholder') ? (
                            <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">No img</div>
                          )}
                        </div>
                      ))}
                      {section.images.length > 3 && (
                        <div className="w-16 h-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                          +{section.images.length - 3}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{section.eyebrow}</Badge>
                        <span className="font-medium truncate">{section.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{section.caption}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{section.images.length} images · Link: {section.link}</p>
                    </div>

                    <Button variant="outline" size="sm" onClick={() => openSectionEditor(section)}>
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {(!carouselSections || carouselSections.length === 0) && !carouselLoading && (
            <div className="text-center py-12">
              <Images className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No carousel sections found</p>
            </div>
          )}
        </TabsContent>

        {/* ===== CONFERENCE MEDIA TAB ===== */}
        <TabsContent value="conference" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Manage the hero image, gallery carousel, and video for the Conference Hall page.
          </p>

          {/* Hero Image */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Hero Background</CardTitle>
              <CardDescription>The full-width background image on the conference page hero section</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="w-48 h-28 rounded-lg overflow-hidden bg-muted shrink-0">
                  {confMediaForm.hero_image ? (
                    <img src={confMediaForm.hero_image} alt="Hero" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No image</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={() => handleUploadConfImage('hero', 'hero_image')} disabled={confSaving}>
                    {confSaving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <ImagePlus className="mr-2 h-3 w-3" />}
                    Upload Image
                  </Button>
                  {confMediaForm.hero_image && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfMediaForm(prev => ({ ...prev, hero_image: '' }))}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gallery Carousel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Gallery Carousel ({confMediaForm.carousel_images.length} images)</CardTitle>
              <CardDescription>Images shown in "The Space" section carousel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {confMediaForm.carousel_images.map((img, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden bg-muted aspect-video">
                    {img.src ? (
                      <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No img</div>
                    )}
                    {/* Overlay controls */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        className="p-1 bg-white/80 rounded text-charcoal disabled:opacity-30"
                        disabled={idx === 0}
                        onClick={() => handleMoveConfImage(idx, -1)}
                      ><ChevronUp className="h-3 w-3" /></button>
                      <button
                        className="p-1 bg-white/80 rounded text-charcoal disabled:opacity-30"
                        disabled={idx === confMediaForm.carousel_images.length - 1}
                        onClick={() => handleMoveConfImage(idx, 1)}
                      ><ChevronDown className="h-3 w-3" /></button>
                      <button
                        className="p-1 bg-red-500/80 rounded text-white"
                        onClick={() => handleRemoveConfCarouselImage(idx)}
                      ><Trash2 className="h-3 w-3" /></button>
                    </div>
                    {/* Alt text */}
                    <input
                      className="absolute bottom-0 left-0 right-0 text-[10px] px-1.5 py-1 bg-black/60 text-white w-full outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                      defaultValue={img.alt}
                      onBlur={(e) => {
                        const images = [...confMediaForm.carousel_images];
                        images[idx] = { ...images[idx], alt: e.target.value };
                        setConfMediaForm(prev => ({ ...prev, carousel_images: images }));
                      }}
                      placeholder="Alt text"
                    />
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={handleUploadConfCarouselImage} disabled={confSaving}>
                {confSaving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plus className="mr-2 h-3 w-3" />}
                Add Image
              </Button>
            </CardContent>
          </Card>

          {/* Video */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Walkthrough Video</CardTitle>
              <CardDescription>Video shown in "See It In Action" section</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-64 h-36 rounded-lg overflow-hidden bg-muted shrink-0">
                  {confMediaForm.video_url ? (
                    <video src={confMediaForm.video_url} poster={confMediaForm.video_poster || undefined} className="w-full h-full object-cover" muted />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No video</div>
                  )}
                </div>
                <div className="space-y-2 flex-1">
                  <Button variant="outline" size="sm" onClick={handleUploadConfVideo} disabled={confSaving}>
                    {confSaving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Video className="mr-2 h-3 w-3" />}
                    Upload Video
                  </Button>
                  {confMediaForm.video_url && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfMediaForm(prev => ({ ...prev, video_url: '' }))}>
                      Remove Video
                    </Button>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Video Caption</Label>
                    <Input
                      value={confMediaForm.video_caption}
                      onChange={(e) => setConfMediaForm(prev => ({ ...prev, video_caption: e.target.value }))}
                      placeholder="Video walkthrough of our conference hall setup"
                    />
                  </div>
                </div>
              </div>

              {/* Poster image */}
              <div className="flex items-center gap-3 pt-2 border-t">
                <div className="w-20 h-12 rounded overflow-hidden bg-muted shrink-0">
                  {confMediaForm.video_poster ? (
                    <img src={confMediaForm.video_poster} alt="Poster" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">Poster</div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Poster Image (thumbnail before video plays)</Label>
                  <Button variant="outline" size="sm" onClick={() => handleUploadConfImage('poster', 'video_poster')} disabled={confSaving}>
                    {confSaving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <ImagePlus className="mr-2 h-3 w-3" />}
                    Upload Poster
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save button */}
          <div className="flex justify-end">
            <Button variant="brass" onClick={handleSaveConfMedia} disabled={confSaving}>
              {confSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Conference Media
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== EDIT CAROUSEL SECTION DIALOG ===== */}
      <Dialog open={!!editingSection} onOpenChange={(open) => { if (!open) setEditingSection(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Images className="h-5 w-5" /> Edit — {editingSection?.eyebrow}
            </DialogTitle>
            <DialogDescription>Manage images and text for this carousel section.</DialogDescription>
          </DialogHeader>

          {editingSection && (
            <div className="space-y-6">
              {/* Text fields */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Section Text</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Eyebrow</Label>
                    <Input value={sectionForm.eyebrow} onChange={(e) => setSectionForm({ ...sectionForm, eyebrow: e.target.value })} placeholder="Stay, Events, Dining..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} placeholder="Wake up to the hills" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Caption</Label>
                  <Textarea value={sectionForm.caption} onChange={(e) => setSectionForm({ ...sectionForm, caption: e.target.value })} rows={2} placeholder="Description text..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Link URL</Label>
                    <Input value={sectionForm.link} onChange={(e) => setSectionForm({ ...sectionForm, link: e.target.value })} placeholder="/rooms" />
                  </div>
                  <div className="space-y-2">
                    <Label>Link Text</Label>
                    <Input value={sectionForm.linkText} onChange={(e) => setSectionForm({ ...sectionForm, linkText: e.target.value })} placeholder="See rooms & rates" />
                  </div>
                </div>
                <Button variant="brass" size="sm" onClick={handleSaveSectionText} disabled={carouselSaving}>
                  {carouselSaving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                  Save Text
                </Button>
              </div>

              {/* Images */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Images ({editingSection.images.length})</h4>

                {/* Upload new image */}
                <div className="flex items-end gap-3 p-3 rounded-lg border border-dashed bg-muted/30">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Upload Image</Label>
                    <input
                      type="file"
                      accept="image/*"
                      className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-brass file:text-white hover:file:bg-brass/90"
                      onChange={(e) => setCarouselUploadFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUploadCarouselImage}
                    disabled={!carouselUploadFile || carouselSaving}
                  >
                    {carouselSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                    Add
                  </Button>
                </div>

                {/* Image list */}
                <div className="space-y-2">
                  {editingSection.images.map((img, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20">
                      <div className="w-20 h-14 rounded overflow-hidden bg-muted shrink-0">
                        {img.src && !img.src.includes('placeholder') ? (
                          <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">No img</div>
                        )}
                      </div>
                      <Input
                        className="flex-1 text-xs"
                        defaultValue={img.alt}
                        onBlur={(e) => handleUpdateImageAlt(idx, e.target.value)}
                        placeholder="Alt text"
                      />
                      <div className="flex flex-col gap-0.5">
                        <button
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          disabled={idx === 0}
                          onClick={() => handleMoveImage(idx, -1)}
                        ><ChevronUp className="h-3 w-3" /></button>
                        <button
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          disabled={idx === editingSection.images.length - 1}
                          onClick={() => handleMoveImage(idx, 1)}
                        ><ChevronDown className="h-3 w-3" /></button>
                      </div>
                      <button
                        className="p-1 text-destructive/60 hover:text-destructive"
                        onClick={() => handleRemoveCarouselImage(idx)}
                      ><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>

                {editingSection.images.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No images yet. Upload one above.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== EDIT HERO SLIDE DIALOG ===== */}
      <Dialog open={editSlideOpen} onOpenChange={setEditSlideOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Hero Slide</DialogTitle>
            <DialogDescription>Update image, caption, alt text, and link for this slide.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current image preview */}
            {editingSlide && (
              <div className="relative">
                <img
                  src={editFile ? URL.createObjectURL(editFile) : editingSlide.image_url}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <label className="absolute bottom-2 right-2 cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setEditFile(e.target.files?.[0] || null)} />
                  <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full hover:bg-black/80 transition-colors">
                    Change Image
                  </span>
                </label>
              </div>
            )}

            <div className="space-y-2">
              <Label>Caption</Label>
              <Input
                value={editForm.caption}
                onChange={(e) => setEditForm({ ...editForm, caption: e.target.value })}
                placeholder="Text overlay on the hero image"
              />
            </div>

            <div className="space-y-2">
              <Label>Alt Text</Label>
              <Input
                value={editForm.alt_text}
                onChange={(e) => setEditForm({ ...editForm, alt_text: e.target.value })}
                placeholder="Accessibility description"
              />
            </div>

            <div className="space-y-2">                    <Label>Link URL (optional)</Label>
              <Input
                value={editForm.link_url}
                onChange={(e) => setEditForm({ ...editForm, link_url: e.target.value })}
                placeholder="/rooms or https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>Icon (optional)</Label>
              <Input
                value={editForm.icon}
                onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                placeholder="e.g. BedDouble, UtensilsCrossed, Sparkles"
              />
              <p className="text-[10px] text-muted-foreground">Lucide icon name — shown on the public site</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setEditSlideOpen(false)}>Cancel</Button>
            <Button variant="brass" onClick={handleSaveEditSlide} disabled={updateSlide.isPending}>
              {updateSlide.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
