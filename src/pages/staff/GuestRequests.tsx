import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGuestRequests, useUpdateGuestRequestStatus } from '@/hooks/useGuestRequests';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Play, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RequestStatus } from '@/lib/types';

export default function GuestRequests() {
  const { data: requests, isLoading } = useGuestRequests();
  const updateStatus = useUpdateGuestRequestStatus();
  const [filter, setFilter] = useState<string>('all');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const filteredRequests = requests?.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      housekeeping: 'Housekeeping',
      maintenance: 'Maintenance',
      room_service: 'Room Service',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const handleStatusChange = async (requestId: string, newStatus: RequestStatus) => {
    try {
      await updateStatus.mutateAsync({ id: requestId, status: newStatus });
      toast.success(`Request ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      toast.error('Failed to update request status');
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Guest Requests</h1>
          <p className="text-muted-foreground">Manage housekeeping, maintenance, and service requests</p>
        </div>
        
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
          <CardDescription>{filteredRequests.length} request(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No guest requests found</p>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{getRequestTypeLabel(request.request_type)}</h3>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Guest</p>
                          <p className="font-medium">{request.bookings?.guests?.name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Room</p>
                          <p className="font-medium">Room {request.bookings?.rooms?.room_number}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Created</p>
                          <p className="font-medium">{format(new Date(request.created_at), 'MMM d, h:mm a')}</p>
                        </div>
                      </div>
                      {request.description && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          <strong>Note:</strong> {request.description}
                        </p>
                      )}
                    </div>
                    
                    {(request.status === 'pending' || request.status === 'in_progress') && (
                      <div className="flex gap-2">
                        {request.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-600 hover:bg-blue-50"
                            onClick={() => handleStatusChange(request.id, 'in_progress')}
                            disabled={updateStatus.isPending}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                          onClick={() => handleStatusChange(request.id, 'completed')}
                          disabled={updateStatus.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => handleStatusChange(request.id, 'cancelled')}
                          disabled={updateStatus.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
