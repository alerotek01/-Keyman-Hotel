import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAllRooms, useCreateRoom, useUpdateRoom, useDeleteRoom } from '@/hooks/useRooms';
import { useRoomTypesList, useCreateRoomType, useUpdateRoomType, useDeleteRoomType } from '@/hooks/useRoomTypes';
import { useUploadRoomImage, useDeleteRoomImage } from '@/hooks/useRoomImages';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Room, RoomTypeEntry } from '@/lib/types';
import { Plus, Pencil, Trash2, Upload, ImageIcon, Loader2, X, BedDouble, Tag } from 'lucide-react';

export default function AdminRooms() {
  const { data: rooms, isLoading: roomsLoading } = useAllRooms();
  const { data: roomTypes, isLoading: typesLoading } = useRoomTypesList();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();
  const createRoomType = useCreateRoomType();
  const updateRoomType = useUpdateRoomType();
  const deleteRoomType = useDeleteRoomType();
  const uploadImage = useUploadRoomImage();
  const deleteImage = useDeleteRoomImage();
  const { toast } = useToast();

  // Room dialog
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState({
    room_number: '',
    room_type_id: '',
    floor: '1',
    base_price: '',
  });

  // Room type dialog
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomTypeEntry | null>(null);
  const [typeForm, setTypeForm] = useState({
    name: '',
    description: '',
    base_rate: '',
    max_occupancy: '2',
    breakfast_price: '',
  });

  const isLoading = roomsLoading || typesLoading;

  // ===== Room handlers =====
  const resetRoomForm = () => {
    setRoomForm({ room_number: '', room_type_id: '', floor: '1', base_price: '' });
    setEditingRoom(null);
  };

  const openRoomCreate = () => { resetRoomForm(); setRoomDialogOpen(true); };

  const openRoomEdit = (room: Room) => {
    setEditingRoom(room);
    setRoomForm({
      room_number: room.room_number.toString(),
      room_type_id: room.room_type_id,
      floor: room.floor.toString(),
      base_price: (room.base_price || room.room_types?.base_rate || 0).toString(),
    });
    setRoomDialogOpen(true);
  };

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        room_number: parseInt(roomForm.room_number),
        room_type_id: roomForm.room_type_id,
        floor: parseInt(roomForm.floor),
        base_price: parseFloat(roomForm.base_price),
      };
      if (editingRoom) {
        await updateRoom.mutateAsync({ id: editingRoom.id, ...payload });
        toast({ title: 'Room Updated', description: 'Room has been updated.' });
      } else {
        await createRoom.mutateAsync(payload);
        toast({ title: 'Room Created', description: 'New room has been added.' });
      }
      setRoomDialogOpen(false);
      resetRoomForm();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed.', variant: 'destructive' });
    }
  };

  const handleRoomDelete = async (room: Room) => {
    if (!confirm(`Deactivate Room ${room.room_number}?`)) return;
    try {
      await deleteRoom.mutateAsync(room.id);
      toast({ title: 'Room Deactivated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // ===== Room Type handlers =====
  const resetTypeForm = () => {
    setTypeForm({ name: '', description: '', base_rate: '', max_occupancy: '2', breakfast_price: '' });
    setEditingType(null);
  };

  const openTypeCreate = () => { resetTypeForm(); setTypeDialogOpen(true); };

  const openTypeEdit = (rt: RoomTypeEntry) => {
    setEditingType(rt);
    setTypeForm({
      name: rt.name,
      description: rt.description || '',
      base_rate: rt.base_rate.toString(),
      max_occupancy: rt.max_occupancy.toString(),
      breakfast_price: rt.breakfast_price.toString(),
    });
    setTypeDialogOpen(true);
  };

  const handleTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: typeForm.name,
        description: typeForm.description || undefined,
        base_rate: parseFloat(typeForm.base_rate),
        max_occupancy: parseInt(typeForm.max_occupancy),
        breakfast_price: parseFloat(typeForm.breakfast_price || '0'),
      };
      if (editingType) {
        await updateRoomType.mutateAsync({ id: editingType.id, ...payload });
        toast({ title: 'Room Type Updated' });
      } else {
        await createRoomType.mutateAsync(payload);
        toast({ title: 'Room Type Created' });
      }
      setTypeDialogOpen(false);
      resetTypeForm();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleTypeDelete = async (rt: RoomTypeEntry) => {
    if (!confirm(`Deactivate room type "${rt.name}"?`)) return;
    try {
      await deleteRoomType.mutateAsync(rt.id);
      toast({ title: 'Room Type Deactivated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Image handlers
  const handleImageUpload = async (roomId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadImage.mutateAsync({ roomId, file });
      toast({ title: 'Image Uploaded' });
    } catch (error: any) {
      toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleImageDelete = async (imageId: string, imageUrl: string) => {
    try {
      await deleteImage.mutateAsync({ imageId, imageUrl });
      toast({ title: 'Image Removed' });
    } catch (error: any) {
      toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
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
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Rooms Management</h1>
        <p className="text-muted-foreground">Manage room types, rooms, pricing, and photos</p>
      </div>

      <Tabs defaultValue="rooms" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rooms" className="gap-2"><BedDouble className="h-4 w-4" /> Rooms</TabsTrigger>
          <TabsTrigger value="types" className="gap-2"><Tag className="h-4 w-4" /> Room Types</TabsTrigger>
        </TabsList>

        {/* ===== ROOMS TAB ===== */}
        <TabsContent value="rooms" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="brass" onClick={openRoomCreate}>
                  <Plus className="mr-2 h-4 w-4" /> Add Room
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingRoom ? `Edit Room ${editingRoom.room_number}` : 'Add Room'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleRoomSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Room Number</Label>
                      <Input type="number" value={roomForm.room_number} onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })} required min={100} />
                    </div>
                    <div className="space-y-2">
                      <Label>Floor</Label>
                      <Input type="number" value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} min={1} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Room Type</Label>
                    <Select value={roomForm.room_type_id} onValueChange={(v) => setRoomForm({ ...roomForm, room_type_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {roomTypes?.filter(rt => rt.is_active).map(rt => (
                          <SelectItem key={rt.id} value={rt.id}>{rt.name} — {formatCurrency(rt.base_rate)}/night</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Base Price (KES/night)</Label>
                    <Input type="number" step="0.01" value={roomForm.base_price} onChange={(e) => setRoomForm({ ...roomForm, base_price: e.target.value })} required />
                  </div>
                  <Button type="submit" variant="brass" className="w-full" disabled={createRoom.isPending || updateRoom.isPending}>
                    {(createRoom.isPending || updateRoom.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingRoom ? 'Update Room' : 'Create Room'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {rooms?.map((room) => (
              <Card key={room.id} className={!room.is_active ? 'opacity-50' : ''}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">Room {room.room_number}</CardTitle>
                    <Badge variant={room.is_active ? 'default' : 'secondary'}>{room.is_active ? 'Active' : 'Inactive'}</Badge>
                    <Badge variant="outline">{room.room_types?.name || 'Unknown'}</Badge>
                    <span className="text-xs text-muted-foreground">Floor {room.floor}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openRoomEdit(room)}><Pencil className="h-4 w-4" /></Button>
                    {room.is_active && <Button variant="outline" size="sm" onClick={() => handleRoomDelete(room)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-4 text-sm mb-4">
                    <span className="font-semibold text-lg">{formatCurrency(room.base_price || Number(room.room_types?.base_rate || 0))}/night</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{room.room_types?.max_occupancy || 2} max guests</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Images</span>
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(room.id, e)} disabled={uploadImage.isPending} />
                        <Button variant="outline" size="sm" asChild>
                          <span>
                            {uploadImage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-1" />Upload</>}
                          </span>
                        </Button>
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(!room.room_images || room.room_images.length === 0) ? (
                        <div className="w-full h-20 bg-muted rounded-lg flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      ) : (
                        room.room_images.map((image) => (
                          <div key={image.id} className="relative group">
                            <img src={image.image_url} alt="Room" className="h-20 w-28 object-cover rounded-lg" />
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
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ===== ROOM TYPES TAB ===== */}
        <TabsContent value="types" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="brass" onClick={openTypeCreate}>
                  <Plus className="mr-2 h-4 w-4" /> Add Room Type
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingType ? `Edit ${editingType.name}` : 'New Room Type'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleTypeSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="e.g. Single, Twin, Studio" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={typeForm.description} onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })} rows={2} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                    <div className="space-y-2">
                      <Label>Base Rate (KES)</Label>
                      <Input type="number" step="0.01" value={typeForm.base_rate} onChange={(e) => setTypeForm({ ...typeForm, base_rate: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Occupancy</Label>
                      <Input type="number" value={typeForm.max_occupancy} onChange={(e) => setTypeForm({ ...typeForm, max_occupancy: e.target.value })} required min={1} />
                    </div>
                    <div className="space-y-2">
                      <Label>Breakfast (KES)</Label>
                      <Input type="number" step="0.01" value={typeForm.breakfast_price} onChange={(e) => setTypeForm({ ...typeForm, breakfast_price: e.target.value })} />
                    </div>
                  </div>
                  <Button type="submit" variant="brass" className="w-full" disabled={createRoomType.isPending || updateRoomType.isPending}>
                    {(createRoomType.isPending || updateRoomType.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingType ? 'Update Type' : 'Create Type'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {roomTypes?.map((rt) => {
              const count = rooms?.filter(r => r.room_type_id === rt.id && r.is_active).length || 0;
              return (
                <Card key={rt.id} className={!rt.is_active ? 'opacity-50' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{rt.name}</CardTitle>
                      <Badge variant={rt.is_active ? 'default' : 'secondary'}>{rt.is_active ? 'Active' : 'Inactive'}</Badge>
                      <Badge variant="outline">{count} room{count !== 1 ? 's' : ''}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openTypeEdit(rt)}><Pencil className="h-4 w-4" /></Button>
                      {rt.is_active && <Button variant="outline" size="sm" onClick={() => handleTypeDelete(rt)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{rt.description || 'No description'}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Base Rate</span>
                        <p className="font-semibold text-lg">{formatCurrency(rt.base_rate)}/night</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Breakfast</span>
                        <p className="font-semibold text-lg">{formatCurrency(rt.breakfast_price)}/person</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Max Occupancy</span>
                        <p className="font-semibold text-lg">{rt.max_occupancy} guests</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
