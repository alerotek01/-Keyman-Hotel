import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useMyHousekeepingTasks, useUpdateHousekeepingTask, useUpdateRoomStatus } from '@/hooks/useHousekeeping';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Play, CheckCircle2, AlertTriangle, BedDouble, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'pending' | 'in_progress' | 'completed';

export default function HousekeeperPda() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const { data: tasks, isLoading } = useMyHousekeepingTasks(user?.id || '', today);
  const updateTask = useUpdateHousekeepingTask();
  const updateRoomStatus = useUpdateRoomStatus();

  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

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

  const pendingCount = tasks?.filter(t => t.status === 'pending').length || 0;
  const inProgressCount = tasks?.filter(t => t.status === 'in_progress').length || 0;
  const completedCount = tasks?.filter(t => t.status === 'completed' || t.status === 'inspected').length || 0;

  const handleStartTask = async (taskId: string, roomId: string) => {
    try {
      await updateTask.mutateAsync({
        id: taskId,
        status: 'in_progress',
      });
      await updateRoomStatus.mutateAsync({
        roomId,
        status: 'cleaning',
        notes: 'Housekeeping started',
      });
      toast.success('Task started');
    } catch (error: any) {
      toast.error(error.message || 'Failed to start task');
    }
  };

  const handleCompleteTask = async (taskId: string, roomId: string) => {
    try {
      await updateTask.mutateAsync({
        id: taskId,
        status: 'completed',
        notes: notes || undefined,
        completed_at: new Date().toISOString(),
      });
      await updateRoomStatus.mutateAsync({
        roomId,
        status: 'clean',
        notes: 'Room cleaned and ready for inspection',
      });
      setNotes('');
      setExpandedTask(null);
      toast.success('Task completed! Room ready for inspection.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete task');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-5 w-5 text-amber-500" />;
      case 'in_progress': return <Play className="h-5 w-5 text-blue-500" />;
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'inspected': return <Sparkles className="h-5 w-5 text-brass" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
      case 'in_progress': return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'completed': return <Badge className="bg-emerald-100 text-emerald-800">Completed</Badge>;
      case 'inspected': return <Badge className="bg-brass/10 text-brass">Inspected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* Header */}
      <div className="bg-charcoal text-cream p-4 sticky top-0 z-10">
        <h1 className="font-display text-xl font-bold">Housekeeping</h1>
        <p className="text-cream/50 text-sm">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Quick Stats */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
        <button
          onClick={() => setFilter('pending')}
          className={cn(
            "p-3 rounded-xl text-center transition-all",
            filter === 'pending' ? "bg-amber-100 ring-2 ring-amber-400" : "bg-white"
          )}
        >
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </button>
        <button
          onClick={() => setFilter('in_progress')}
          className={cn(
            "p-3 rounded-xl text-center transition-all",
            filter === 'in_progress' ? "bg-blue-100 ring-2 ring-blue-400" : "bg-white"
          )}
        >
          <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
          <p className="text-xs text-muted-foreground">In Progress</p>
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={cn(
            "p-3 rounded-xl text-center transition-all",
            filter === 'completed' ? "bg-emerald-100 ring-2 ring-emerald-400" : "bg-white"
          )}
        >
          <p className="text-2xl font-bold text-emerald-600">{completedCount}</p>
          <p className="text-xs text-muted-foreground">Done</p>
        </button>
      </div>

      {/* Task List */}
      <div className="px-4 space-y-3">
        {filter === 'all' && (
          <button
            onClick={() => setFilter('all')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Showing all {filteredTasks.length} tasks
          </button>
        )}

        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <BedDouble className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {filter === 'all' ? 'No tasks assigned today' : `No ${filter.replace('_', ' ')} tasks`}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const room = task.rooms;
            const roomType = room?.room_types?.name || 'Room';
            const isExpanded = expandedTask === task.id;

            return (
              <Card key={task.id} className={cn(
                "transition-all",
                task.status === 'in_progress' && "ring-2 ring-blue-200",
                task.status === 'completed' && "opacity-70",
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(task.status)}
                      <div>
                        <h3 className="font-semibold text-lg">Room {room?.room_number}</h3>
                        <p className="text-sm text-muted-foreground">
                          {roomType} • Floor {room?.floor}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(task.status)}
                  </div>

                  {task.notes && (
                    <p className="text-sm text-muted-foreground mb-3 bg-muted/50 p-2 rounded-lg">
                      📝 {task.notes}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="space-y-2">
                    {task.status === 'pending' && (
                      <Button
                        variant="default"
                        size="lg"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleStartTask(task.id, task.rooms?.id)}
                        disabled={updateTask.isPending || updateRoomStatus.isPending}
                      >
                        <Play className="mr-2 h-5 w-5" />
                        Start Cleaning
                      </Button>
                    )}

                    {task.status === 'in_progress' && (
                      <>
                        {!isExpanded ? (
                          <Button
                            variant="default"
                            size="lg"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => setExpandedTask(task.id)}
                          >
                            <CheckCircle2 className="mr-2 h-5 w-5" />
                            Mark Complete
                          </Button>
                        ) : (
                          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                            <Textarea
                              placeholder="Notes (optional) — e.g. 'replaced towels, restocked minibar'"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => { setExpandedTask(null); setNotes(''); }}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="default"
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleCompleteTask(task.id, task.rooms?.id)}
                                disabled={updateTask.isPending || updateRoomStatus.isPending}
                              >
                                {(updateTask.isPending || updateRoomStatus.isPending) && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Confirm Complete
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {task.status === 'completed' && (
                      <p className="text-sm text-emerald-600 text-center py-2">
                        ✓ Waiting for supervisor inspection
                      </p>
                    )}

                    {task.status === 'inspected' && (
                      <p className="text-sm text-brass text-center py-2">
                        ✨ Inspected — Room is ready
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
