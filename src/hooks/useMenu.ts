import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ===== Menu Categories =====
export function useMenuCategories() {
  return useQuery({
    queryKey: ['menu-categories'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('menu_categories')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateMenuCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; sort_order?: number }) => {
      const { data: cat, error } = await sb
        .from('menu_categories')
        .insert({ name: data.name, sort_order: data.sort_order || 0 })
        .select()
        .single();
      if (error) throw error;
      return cat;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-categories'] }),
  });
}

export function useUpdateMenuCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; sort_order?: number; is_active?: boolean }) => {
      const { data: cat, error } = await sb
        .from('menu_categories')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return cat;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-categories'] }),
  });
}

export function useDeleteMenuCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('menu_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-categories'] }),
  });
}

// ===== Menu Items =====
export function useMenuItems() {
  return useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('menu_items')
        .select('*, menu_categories(id, name)')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      price: number;
      category_id: string;
      photo_url?: string;
      is_available?: boolean;
    }) => {
      const { data: item, error } = await sb
        .from('menu_items')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return item;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }),
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; price?: number; category_id?: string; photo_url?: string; is_available?: boolean }) => {
      const { data: item, error } = await sb
        .from('menu_items')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return item;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('menu_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }),
  });
}

// ===== Menu Item Image Upload =====
export function useUploadMenuItemImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, file }: { itemId: string; file: File }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `menu/${itemId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await sb.storage
        .from('rooms')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = sb.storage
        .from('rooms')
        .getPublicUrl(fileName);

      const { error: updateError } = await sb
        .from('menu_items')
        .update({ image_url: publicUrl })
        .eq('id', itemId);
      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }),
  });
}
