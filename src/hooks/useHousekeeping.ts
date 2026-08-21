import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ===== Housekeeping Tasks =====
export function useHousekeepingTasks(date?: string) {
  return useQuery({
    queryKey: ['housekeeping-tasks', date],
    queryFn: async () => {
      const queryDate = date || new Date().toISOString().split('T')[0];
      const { data, error } = await sb
        .from('housekeeping_tasks')
        .select(`
          *,
          rooms (id, room_number, floor, status, room_types (name)),
          users:assigned_to (id, full_name)
        `)
        .eq('shift_date', queryDate)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useMyHousekeepingTasks(userId: string, date?: string) {
  return useQuery({
    queryKey: ['housekeeping-tasks', 'mine', userId, date],
    queryFn: async () => {
      const queryDate = date || new Date().toISOString().split('T')[0];
      const { data, error } = await sb
        .from('housekeeping_tasks')
        .select(`
          *,
          rooms (id, room_number, floor, status, room_types (name))
        `)
        .eq('assigned_to', userId)
        .eq('shift_date', queryDate)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useDirtyRooms() {
  return useQuery({
    queryKey: ['rooms', 'dirty'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('rooms')
        .select(`
          id, room_number, floor, status,
          room_types (name),
          reservations!inner (id, guest_id, guests (name), check_out)
        `)
        .in('status', ['dirty', 'cleaning'])
        .order('room_number');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateHousekeepingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      room_id: string;
      assigned_to?: string;
      shift_date: string;
      notes?: string;
    }) => {
      const { data: task, error } = await sb
        .from('housekeeping_tasks')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateHousekeepingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      status?: string;
      notes?: string;
      completed_at?: string;
      inspected_by?: string;
      inspected_at?: string;
    }) => {
      const { data: task, error } = await sb
        .from('housekeeping_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useBulkCreateTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tasks: { room_id: string; assigned_to?: string; shift_date: string; notes?: string }[]) => {
      const { data, error } = await sb
        .from('housekeeping_tasks')
        .insert(tasks)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
    },
  });
}

// ===== Room Status Updates =====
export function useUpdateRoomStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomId, status, notes }: { roomId: string; status: string; notes?: string }) => {
      // Update room status
      const { error: roomErr } = await sb
        .from('rooms')
        .update({ status })
        .eq('id', roomId);
      if (roomErr) throw roomErr;

      // Log to room_status_history
      const { error: histErr } = await sb
        .from('room_status_history')
        .insert({ room_id: roomId, status, notes: notes || null });
      if (histErr) throw histErr;

      return { roomId, status };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
    },
  });
}

// ===== Housekeeping Stats =====
export function useHousekeepingStats(date?: string) {
  return useQuery({
    queryKey: ['housekeeping-stats', date],
    queryFn: async () => {
      const queryDate = date || new Date().toISOString().split('T')[0];

      // Get all rooms
      const { data: rooms } = await sb
        .from('rooms')
        .select('id, status')
        .eq('is_active', true);

      // Get today's tasks
      const { data: tasks } = await sb
        .from('housekeeping_tasks')
        .select('id, status')
        .eq('shift_date', queryDate);

      const totalRooms = rooms?.length || 0;
      const dirtyRooms = rooms?.filter((r: any) => r.status === 'dirty').length || 0;
      const cleaningRooms = rooms?.filter((r: any) => r.status === 'cleaning').length || 0;
      const cleanRooms = rooms?.filter((r: any) => r.status === 'clean').length || 0;
      const inspectedRooms = rooms?.filter((r: any) => r.status === 'inspected').length || 0;
      const occupiedRooms = rooms?.filter((r: any) => r.status === 'occupied').length || 0;
      const availableRooms = rooms?.filter((r: any) => r.status === 'available').length || 0;

      const totalTasks = tasks?.length || 0;
      const pendingTasks = tasks?.filter((t: any) => t.status === 'pending').length || 0;
      const inProgressTasks = tasks?.filter((t: any) => t.status === 'in_progress').length || 0;
      const completedTasks = tasks?.filter((t: any) => t.status === 'completed').length || 0;
      const inspectedTasks = tasks?.filter((t: any) => t.status === 'inspected').length || 0;

      return {
        totalRooms,
        dirtyRooms,
        cleaningRooms,
        cleanRooms,
        inspectedRooms,
        occupiedRooms,
        availableRooms,
        totalTasks,
        pendingTasks,
        inProgressTasks,
        completedTasks,
        inspectedTasks,
      };
    },
  });
}
