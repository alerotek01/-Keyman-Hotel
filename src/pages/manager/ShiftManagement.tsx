import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Clock, Users, LogIn, LogOut, Calendar } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function ShiftManagement() {
  const { data: shifts, isLoading } = useQuery({
    queryKey: ['shift-records'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('shift_opening_records')
        .select('*, users:user_id(full_name, email, role)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: reconciliationData } = useQuery({
    queryKey: ['shift-reconciliations'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('shift_reconciliations')
        .select('*, users:user_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-brass" /></div>;
  }

  // Group by status (enum: not_started, active, ended, submitted, reconciled, closed)
  const activeShifts = (shifts || []).filter((s: any) => s.status === 'active' || s.status === 'not_started');
  const endedShifts = (shifts || []).filter((s: any) => s.status === 'ended' || s.status === 'closed' || s.status === 'submitted' || s.status === 'reconciled');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Clock className="h-6 w-6 text-brass" />
          Shift Management
        </h1>
        <p className="text-muted-foreground mt-1">View and manage staff shifts across all departments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-brass/5 border-brass/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-brass">{activeShifts.length}</p>
            <p className="text-xs text-muted-foreground">Open Shifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{endedShifts.length}</p>
            <p className="text-xs text-muted-foreground">Closed Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{reconciliationData?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Reconciliations</p>
          </CardContent>
        </Card>
      </div>

      {/* Open Shifts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
            Currently On Shift ({activeShifts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeShifts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No staff currently on shift</p>
          ) : (
            <div className="space-y-2">
              {activeShifts.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center">
                      <LogIn className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.users?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.users?.role || 'Staff'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Since {s.shift_start ? format(new Date(s.shift_start), 'h:mm a') : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Closed Shifts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Shifts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {endedShifts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No closed shifts yet</p>
          ) : (
            <div className="space-y-2">
              {endedShifts.slice(0, 15).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <LogOut className="h-3.5 w-3.5 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.users?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.shift_start ? format(new Date(s.shift_start), 'MMM d, h:mm a') : '—'}
                        {' → '}
                        {s.shift_end ? format(new Date(s.shift_end), 'h:mm a') : '—'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Closed</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
