import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useUploadRoomImage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ roomId, file }: { roomId: string; file: File }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${roomId}/${Date.now()}.${fileExt}`;
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('rooms')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('rooms')
        .getPublicUrl(fileName);

      // Save reference in room_images table
      const { data, error: insertError } = await supabase
        .from('room_images')
        .insert({
          room_id: roomId,
          image_url: publicUrl,
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useDeleteRoomImage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ imageId, imageUrl }: { imageId: string; imageUrl: string }) => {
      // Extract file path from URL
      const urlParts = imageUrl.split('/rooms/');
      const filePath = urlParts[urlParts.length - 1];
      
      // Delete from storage
      await supabase.storage
        .from('rooms')
        .remove([filePath]);

      // Delete from database
      const { error } = await supabase
        .from('room_images')
        .delete()
        .eq('id', imageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
