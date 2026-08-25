import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useReceipts, useUploadReceipt } from '@/hooks/useReceipts';
import { useBookings } from '@/hooks/useBookings';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Upload, Receipt, ExternalLink } from 'lucide-react';

export default function Receipts() {
  const { data: receipts, isLoading: receiptsLoading } = useReceipts();
  const { data: bookings } = useBookings();
  const uploadReceipt = useUploadReceipt();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (receiptsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const confirmedBookings = bookings?.filter(b => b.status === 'confirmed') || [];

  const handleUpload = async () => {
    if (!selectedBookingId || !selectedFile) {
      toast.error('Please select a booking and upload a file');
      return;
    }

    try {
      await uploadReceipt.mutateAsync({
        booking_id: selectedBookingId,
        file: selectedFile,
        notes: notes || undefined,
      });
      toast.success('Receipt uploaded successfully');
      setIsDialogOpen(false);
      setSelectedBookingId('');
      setNotes('');
      setSelectedFile(null);
    } catch (error) {
      toast.error('Failed to upload receipt');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Payment Receipts</h1>
          <p className="text-muted-foreground">Upload and manage payment confirmations</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="brass">
              <Upload className="h-4 w-4 mr-2" />
              Upload Receipt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Payment Receipt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Booking</Label>
                <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a booking" />
                  </SelectTrigger>
                  <SelectContent>
                    {confirmedBookings.map((booking) => (
                      <SelectItem key={booking.id} value={booking.id}>
                        {booking.guests?.name} - Room {booking.rooms?.room_number} ({formatCurrency(Number(booking.rate))})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Receipt File</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                />
              </div>

              <Button 
                className="w-full" 
                onClick={handleUpload}
                disabled={uploadReceipt.isPending || !selectedBookingId || !selectedFile}
              >
                {uploadReceipt.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Receipt
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Receipts</CardTitle>
          <CardDescription>{receipts?.length || 0} receipt(s) uploaded</CardDescription>
        </CardHeader>
        <CardContent>
          {(receipts?.length || 0) === 0 ? (
            <p className="text-muted-foreground text-center py-8">No receipts uploaded yet</p>
          ) : (
            <div className="space-y-4">
              {receipts?.map((receipt) => (
                <div key={receipt.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-brass/10 flex items-center justify-center">
                        <Receipt className="h-6 w-6 text-brass" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{receipt.bookings?.guests?.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Room {receipt.bookings?.rooms?.room_number} • {formatCurrency(Number(receipt.bookings?.rate || 0))}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploaded {format(new Date(receipt.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                        {receipt.notes && (
                          <p className="text-sm mt-2">{receipt.notes}</p>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(receipt.receipt_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Receipt
                    </Button>
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
