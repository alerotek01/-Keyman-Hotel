import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ===== Site Settings =====
export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('site_settings')
        .select('*')
        .order('key');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpdateSiteSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data, error } = await sb
        .from('site_settings')
        .upsert({ key, value }, { onConflict: 'key' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['site-settings'] }),
  });
}

// ===== Page Content =====
export function usePageContent(page?: string) {
  return useQuery({
    queryKey: ['page-content', page],
    queryFn: async () => {
      let query = sb.from('page_content').select('*').order('sort_order');
      if (page) query = query.eq('page', page);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpdatePageContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; heading?: string; subheading?: string; body?: string; cta_text?: string; cta_link?: string; image_url?: string; is_active?: boolean }) => {
      const { data: content, error } = await sb
        .from('page_content')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return content;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['page-content'] }),
  });
}

export function useCreatePageContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { page: string; section: string; heading?: string; subheading?: string; body?: string; cta_text?: string; cta_link?: string; image_url?: string; sort_order?: number }) => {
      const { data: content, error } = await sb
        .from('page_content')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return content;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['page-content'] }),
  });
}

// ===== Hero Slides =====
export function useHeroSlides() {
  return useQuery({
    queryKey: ['hero-slides'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('hero_slides')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateHeroSlide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { image_url: string; caption?: string; alt_text?: string; sort_order?: number }) => {
      const { data: slide, error } = await sb
        .from('hero_slides')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return slide;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hero-slides'] }),
  });
}

export function useUpdateHeroSlide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; caption?: string; alt_text?: string; link_url?: string | null; icon?: string | null; sort_order?: number; is_active?: boolean }) => {
      const { data: slide, error } = await sb
        .from('hero_slides')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return slide;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hero-slides'] }),
  });
}

export function useDeleteHeroSlide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('hero_slides').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hero-slides'] }),
  });
}

// ===== Hero Slide Image Upload =====
export function useUploadHeroSlideImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ slideId, file }: { slideId: string; file: File }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `hero/${slideId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await sb.storage
        .from('rooms')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = sb.storage
        .from('rooms')
        .getPublicUrl(fileName);

      const { error: updateError } = await sb
        .from('hero_slides')
        .update({ image_url: publicUrl })
        .eq('id', slideId);
      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hero-slides'] }),
  });
}
