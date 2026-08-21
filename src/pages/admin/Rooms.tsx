import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAllRooms, useCreateRoom, useUpdateRoom, useDeleteRoom } from '@/hooks/useRooms';
import { useUploadRoomImage, useDeleteRoomImage } from '@/hooks/useRoomImages';
import { formatCurrency, getRoomTypeLabel } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Room, RoomType } from '@/lib/types';
import { Plus, Pencil, Trash2, Upload, ImageIcon, Loader2, X } from 'lucide-react';

export default function AdminRooms() {
  const { data: rooms, isLoading } = useAllRooms();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();
  const uploadImage = useUploadRoomImage();
  const deleteImage = useDeleteRoomImage();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({
    room_number: '',
    room_type: 'SINGLE' as RoomType,
    description: '',
    base_price: '',
    breakfast_price: '',
    total_rooms: '',
  });

  const resetForm = () => {
    setFormData({
      room_number: '',
      room_type: 'SINGLE',
      description: '',
      base_price: '',
      breakfast_price: '',
      total_rooms: '',
    });
    setEditingRoom(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number.toString(),
      room_type: room.room_type,
      description: room.description || '',
      base_price: room.base_price.toString(),
      breakfast_price: room.breakfast_price.toString(),
      total_rooms: room.total_rooms.toString(),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingRoom) {
        await updateRoom.mutateAsync({
          id: editingRoom.id,
          room_number: parseInt(formData.room_number),
          room_type: formData.room_type,
          description: formData.description,
          base_price: parseFloat(formData.base_price),
          breakfast_price: parseFloat(formData.breakfast_price),
          total_rooms: parseInt(formData.total_rooms),
        });
        toast({ title: 'Room Updated', description: 'Room has been updated successfully.' });
      } else {
        await createRoom.mutateAsync({
          room_number: parseInt(formData.room_number),
          room_type: formData.room_type,
          description: formData.description,
          base_price: parseFloat(formData.base_price),
          breakfast_price: parseFloat(formData.breakfast_price),
          total_rooms: parseInt(formData.total_rooms),
        });
        toast({ title: 'Room Created', description: 'New room has been created successfully.' });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'An error occurred.',
        variant: 'destructive' 
      });
    }
  };

  const handleDelete = async (room: Room) => {
    if (confirm(`Are you sure you want to deactivate Room ${room.room_number}?`)) {
      try {
        await deleteRoom.mutateAsync(room.id);
        toast({ title: 'Room Deactivated', description: 'Room has been deactivated.' });
      } catch (error: any) {
        toast({ 
          title: 'Error', 
          description: error.message || 'An error occurred.',
          variant: 'destructive' 
        });
      }
    }
  };

  const handleImageUpload = async (roomId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadImage.mutateAsync({ roomId, file });
      toast({ title: 'Image Uploaded', description: 'Room image has been uploaded.' });
    } catch (error: any) {
      toast({ 
        title: 'Upload Failed', 
        description: error.message || 'Failed to upload image.',
        variant: 'destructive' 
      });
    }
  };

  const handleImageDelete = async (imageId: string, imageUrl: string) => {
    try {
      await deleteImage.mutateAsync({ imageId, imageUrl });
      toast({ title: 'Image Deleted', description: 'Room image has been removed.' });
    } catch (error: any) {
      toast({ 
        title: 'Delete Failed', 
        description: error.message || 'Failed to delete image.',
        variant: 'destructive' 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Rooms Management</h1>
          <p className="text-muted-foreground">Manage your hotel rooms and pricing</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="brass" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Room
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? `Edit Room ${editingRoom.room_number}` : 'Add New Room'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Room Number</Label>
                  <Input
                    type="number"
                    value={formData.room_number}
                    onChange={(e) => setFormData({...formData, room_number: e.target.value})}
                    required
                    min={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Room Type</Label>
                  <Select 
                    value={formData.room_type} 
                    onValueChange={(v) => setFormData({...formData, room_type: v as RoomType})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINGLE">Single</SelectItem>
                      <SelectItem value="STUDIO">Studio</SelectItem>
                      <SelectItem value="TWIN">Twin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Base Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.base_price}
                    onChange={(e) => setFormData({...formData, base_price: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Breakfast ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.breakfast_price}
                    onChange={(e) => setFormData({...formData, breakfast_price: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input
                    type="number"
                    value={formData.total_rooms}
                    onChange={(e) => setFormData({...formData, total_rooms: e.target.value})}
                    required
                    min={1}
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                variant="brass" 
                className="w-full"
                disabled={createRoom.isPending || updateRoom.isPending}
              >
                {(createRoom.isPending || updateRoom.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingRoom ? 'Update Room' : 'Create Room'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {rooms?.map((room) => (
          <Card key={room.id} className={!room.is_active ? 'opacity-50' : ''}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl">Room {room.room_number}</CardTitle>
                  <Badge variant={room.is_active ? 'default' : 'secondary'}>
                    {room.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline">{getRoomTypeLabel(room.room_type)}</Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">{room.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditDialog(room)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {room.is_active && (
                  <Button variant="outline" size="sm" onClick={() => handleDelete(room)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Base Price</span>
                      <p className="font-semibold text-lg">{formatCurrency(Number(room.base_price))}/night</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Breakfast</span>
                      <p className="font-semibold text-lg">{formatCurrency(Number(room.breakfast_price))}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Capacity</span>
                      <p className="font-semibold text-lg">{room.total_rooms} rooms</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Room Images</span>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(room.id, e)}
                        disabled={uploadImage.isPending}
                      />
                      <Button variant="outline" size="sm" asChild>
                        <span>
                          {uploadImage.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-1" />
                              Upload
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {room.room_images?.length === 0 ? (
                      <div className="w-full h-24 bg-muted rounded-lg flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    ) : (
                      room.room_images?.map((image) => (
                        <div key={image.id} className="relative group">
                          <img
                            src={image.image_url}
                            alt="Room"
                            className="h-24 w-32 object-cover rounded-lg"
                          />
                          <button
                            onClick={() => handleImageDelete(image.id, image.image_url)}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
