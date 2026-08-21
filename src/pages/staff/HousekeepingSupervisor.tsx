import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useHousekeepingTasks, useUpdateHousekeepingTask, useUpdateRoomStatus } from '@/hooks/useHousekeeping';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Sparkles, AlertTriangle, ClipboardCheck, BedDouble, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'completed' | 'inspected' | 'in_progress';

export default function HousekeepingSupervisor() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const { data: tasks, isLoading } = useHousekeepingTasks(today);
  const updateTask = useUpdateHousekeepingTask();
  const updateRoomStatus = useUpdateRoomStatus();

  const [filter, setFilter] = useState<FilterType>('completed');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [inspectionNotes, setInspectionNotes] = useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const filteredTasks = tasks?.filter(t => {
    if (filter === 'all') return true;
    return t.status === filter;
  }) || [];

  const completedTasks = tasks?.filter(t => t.status === 'completed') || [];
  const inspectedTasks = tasks?.filter(t => t.status === 'inspected') || [];
  const inProgressTasks = tasks?.filter(t => t.status === 'in_progress') || [];

  const handleApprove = async (taskId: string, roomId: string) => {
    try {
      await updateTask.mutateAsync({
        id: taskId,
        status: 'inspected',
        inspected_by: user?.id,
        inspected_at: new Date().toISOString(),
        notes: inspectionNotes || undefined,
      });
      await updateRoomStatus.mutateAsync({
        roomId,
        status: 'inspected',
        notes: 'Room inspected and approved',
      });
      setInspectionNotes('');
      setExpandedTask(null);
      toast.success('Room inspected and approved! Now available for check-in.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve');
    }
  };

  const handleReject = async (taskId: string, roomId: string) => {
    try {
      // Reset task back to pending and room back to dirty
      await updateTask.mutateAsync({
        id: taskId,
        status: 'pending',
        notes: `Rejected: ${inspectionNotes || 'Needs re-cleaning'}`,
        completed_at: null,
      });
      await updateRoomStatus.mutateAsync({
        roomId,
        status: 'dirty',
        notes: 'Inspection failed — needs re-cleaning',
      });
      setInspectionNotes('');
      setExpandedTask(null);
      toast.error('Room rejected — sent back for re-cleaning');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject');
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* Header */}
      <div className="bg-charcoal text-cream p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold">Inspection</h1>
            <p className="text-cream/50 text-sm">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-brass" />
            <span className="text-sm font-medium">{completedTasks.length} pending</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="p-4 flex gap-2 overflow-x-auto">
        {([
          { key: 'completed' as const, label: 'Needs Inspection', count: completedTasks.length, color: 'bg-emerald-100 text-emerald-800' },
          { key: 'inspected' as const, label: 'Inspected', count: inspectedTasks.length, color: 'bg-brass/10 text-brass' },
          { key: 'in_progress' as const, label: 'In Progress', count: inProgressTasks.length, color: 'bg-blue-100 text-blue-800' },
          { key: 'all' as const, label: 'All', count: tasks?.length || 0, color: 'bg-gray-100 text-gray-800' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              filter === tab.key ? tab.color + " ring-2 ring-offset-1" : "bg-white text-muted-foreground"
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="px-4 space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <Eye className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {filter === 'completed' ? 'All rooms inspected!' : 'No tasks in this category'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const room = task.rooms;
            const roomType = room?.room_types?.name || 'Room';
            const cleaner = (task as any).users?.full_name || 'Unassigned';
            const isExpanded = expandedTask === task.id;

            return (
              <Card key={task.id} className={cn(
                "transition-all",
                task.status === 'completed' && "ring-2 ring-emerald-200",
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <BedDouble className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Room {room?.room_number}</h3>
                        <p className="text-sm text-muted-foreground">{roomType} • Floor {room?.floor}</p>
                      </div>
                    </div>
                    <Badge className={
                      task.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                      task.status === 'inspected' ? 'bg-brass/10 text-brass' :
                      'bg-blue-100 text-blue-800'
                    }>
                      {task.status === 'completed' ? 'Ready' : task.status === 'inspected' ? 'Done' : 'Cleaning'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span>Cleaner: <strong>{cleaner}</strong></span>
                    {task.completed_at && (
                      <span>Completed: {format(new Date(task.completed_at), 'h:mm a')}</span>
                    )}
                  </div>

                  {task.notes && (
                    <div className="bg-muted/50 rounded-lg p-2 mb-3 text-sm">
                      <span className="text-muted-foreground">Cleaner notes:</span> {task.notes}
                    </div>
                  )}

                  {/* Inspection Actions */}
                  {task.status === 'completed' && (
                    <div className="space-y-2">
                      {!isExpanded ? (
                        <Button
                          variant="default"
                          size="lg"
                          className="w-full bg-brass hover:bg-brass/90 text-white"
                          onClick={() => setExpandedTask(task.id)}
                        >
                          <Eye className="mr-2 h-5 w-5" />
                          Inspect Room
                        </Button>
                      ) : (
                        <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                          <Textarea
                            placeholder="Inspection notes (optional)"
                            value={inspectionNotes}
                            onChange={(e) => setInspectionNotes(e.target.value)}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="destructive"
                              className="flex-1"
                              onClick={() => handleReject(task.id, task.rooms?.id)}
                              disabled={updateTask.isPending || updateRoomStatus.isPending}
                            >
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                            <Button
                              variant="default"
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleApprove(task.id, task.rooms?.id)}
                              disabled={updateTask.isPending || updateRoomStatus.isPending}
                            >
                              {(updateTask.isPending || updateRoomStatus.isPending) && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              <Sparkles className="mr-2 h-4 w-4" />
                              Approve
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => { setExpandedTask(null); setInspectionNotes(''); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {task.status === 'inspected' && (
                    <div className="flex items-center justify-center gap-2 text-sm text-brass py-2">
                      <Sparkles className="h-4 w-4" />
                      <span>Inspected — Room available for check-in</span>
                    </div>
                  )}

                  {task.status === 'in_progress' && (
                    <p className="text-sm text-blue-600 text-center py-2">
                      🔄 Cleaning in progress...
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
