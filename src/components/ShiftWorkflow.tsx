import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, Play, CheckCircle2, Check, X } from 'lucide-react';

interface ShiftWorkflowProps {
  assignedShifts: any[];
  acceptedShifts: any[];
  currentShift: any;
  onAccept: (shiftId: string) => void;
  onReject: (shiftId: string) => void;
  onStart: (shiftName: string) => void;
  isAcceptPending: boolean;
  isStartPending: boolean;
}

export default function ShiftWorkflow({
  assignedShifts,
  acceptedShifts,
  currentShift,
  onAccept,
  onReject,
  onStart,
  isAcceptPending,
  isStartPending,
}: ShiftWorkflowProps) {
  if (currentShift) return null;
  if (assignedShifts.length === 0 && acceptedShifts.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      {assignedShifts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" /> Shifts Awaiting Your Acceptance ({assignedShifts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assignedShifts.map((shift: any) => (
              <div key={shift.id} className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-white">
                <div>
                  <p className="font-medium capitalize">{shift.shift_name} Shift</p>
                  <p className="text-xs text-muted-foreground">{shift.shift_date} · {shift.departments?.name || 'Hotel'}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                    onClick={() => onAccept(shift.id)} disabled={isAcceptPending}>
                    <Check className="h-3 w-3 mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => onReject(shift.id)}>
                    <X className="h-3 w-3 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {acceptedShifts.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Ready to Start ({acceptedShifts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {acceptedShifts.map((shift: any) => (
                <button
                  key={shift.id}
                  onClick={() => onStart(shift.shift_name)}
                  disabled={isStartPending}
                  className="p-4 rounded-xl border-2 border-emerald-200 hover:border-brass hover:bg-brass/5 transition-all text-center capitalize"
                >
                  <Play className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                  <p className="font-medium">{shift.shift_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Tap to start</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
