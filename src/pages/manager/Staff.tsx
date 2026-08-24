import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { sendWelcomeEmail } from '@/lib/email';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, Plus, Shield, UserCog, UserX, UserCheck, Mail, Phone, Trash2, Users, Clock, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ROLES: { value: AppRole; label: string; color: string }[] = [
  { value: 'receptionist', label: 'Receptionist', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'waiter', label: 'Waiter', color: 'bg-orange-100 text-orange-800' },
  { value: 'chef', label: 'Chef', color: 'bg-purple-100 text-purple-800' },
  { value: 'housekeeper', label: 'Housekeeper', color: 'bg-amber-100 text-amber-800' },
  { value: 'accountant', label: 'Accountant', color: 'bg-teal-100 text-teal-800' },
  { value: 'manager', label: 'Manager', color: 'bg-blue-100 text-blue-800' },
];

export default function StaffManagement() {
  const qc = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '' });
  const [form, setForm] = useState({ email: '', full_name: '', phone: '', role: 'receptionist' as AppRole, password: '' });

  // List all staff
  const { data: users, isLoading } = useQuery({
    queryKey: ['manager-staff'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Create user
  const createUser = useMutation({
    mutationFn: async (data: { email: string; password: string; full_name: string; phone: string; role: AppRole }) => {
      const { data: authData, error: authError } = await sb.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.full_name } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');

      const { error: insertError } = await sb.from('users').insert({
        id: authData.user.id,
        email: data.email,
        full_name: data.full_name,
        phone: data.phone || null,
        role: data.role,
        is_active: true,
      });
      if (insertError) throw insertError;

      await sendWelcomeEmail(data.email, data.full_name, data.role, data.password);
      return authData.user;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-staff'] });
      setCreateDialogOpen(false);
      setForm({ email: '', full_name: '', phone: '', role: 'receptionist', password: '' });
      toast.success('Staff account created');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create user');
    },
  });

  // Update user
  const updateUser = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; role?: AppRole; is_active?: boolean }) => {
      const { error } = await sb.from('users').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-staff'] });
      toast.success('Staff updated');
    },
  });

  // Edit user profile
  const editUserMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; full_name: string; email: string; phone: string }) => {
      const { error } = await sb.from('users').update({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-staff'] });
      setEditDialogOpen(false);
      setEditUser(null);
      toast.success('Staff profile updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update');
    },
  });

  // Delete user
  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('users').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-staff'] });
      toast.success('Staff removed');
    },
  });

  const handleSuspend = (user: any) => {
    if (!confirm(`Suspend ${user.full_name}? They won't be able to log in.`)) return;
    updateUser.mutate({ id: user.id, is_active: false });
  };

  const handleApprove = (user: any) => {
    updateUser.mutate({ id: user.id, is_active: true });
  };

  const handleRoleChange = (userId: string, newRole: AppRole) => {
    updateUser.mutate({ id: userId, role: newRole });
  };

  const getRoleInfo = (role: string) => ROLES.find(r => r.value === role) || ROLES[0];

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-brass" /></div>;
  }

  const STAFF_ROLES = ['receptionist', 'waiter', 'chef', 'housekeeper', 'accountant', 'manager'];
  const activeUsers = users?.filter((u: any) => u.is_active && STAFF_ROLES.includes(u.role)) || [];
  const suspendedUsers = users?.filter((u: any) => !u.is_active && STAFF_ROLES.includes(u.role)) || [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground">Create, suspend, and manage staff accounts</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="brass" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Staff Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createUser.mutate(form); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required placeholder="e.g. John Mwangi" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="john@keymanhotel.co.ke" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254700000000" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} placeholder="Min 6 characters" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" variant="brass" className="w-full" disabled={createUser.isPending}>
                {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{activeUsers.length + suspendedUsers.length}</p>
            <p className="text-xs text-muted-foreground">Total Staff</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-emerald-600">{activeUsers.length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-red-600">{suspendedUsers.length}</p>
            <p className="text-xs text-muted-foreground">Suspended</p>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({activeUsers.length})</TabsTrigger>
          <TabsTrigger value="suspended">Suspended ({suspendedUsers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3 mt-4">
          {activeUsers.map((user: any) => {
            const roleInfo = getRoleInfo(user.role);
            return (
              <Card key={user.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-brass/10 flex items-center justify-center">
                        <UserCog className="h-5 w-5 text-brass" />
                      </div>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{user.email}</span>
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{user.phone || 'No phone'}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={user.role} onValueChange={(v) => handleRoleChange(user.id, v as AppRole)}>
                        <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Badge className={cn(roleInfo.color)}>{roleInfo.label}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditUser(user);
                      setEditForm({ full_name: user.full_name || '', email: user.email || '', phone: user.phone || '' });
                      setEditDialogOpen(true);
                    }}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => handleSuspend(user)}>
                      <UserX className="h-3 w-3 mr-1" /> Suspend
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {activeUsers.length === 0 && <p className="text-muted-foreground text-center py-8">No active staff</p>}
        </TabsContent>

        <TabsContent value="suspended" className="space-y-3 mt-4">
          {suspendedUsers.map((user: any) => {
            const roleInfo = getRoleInfo(user.role);
            return (
              <Card key={user.id} className="opacity-60">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <UserX className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={cn(roleInfo.color)}>{roleInfo.label}</Badge>
                    <Badge variant="secondary">Suspended</Badge>
                    <Button variant="outline" size="sm" onClick={() => handleApprove(user)}>
                      <UserCheck className="h-4 w-4 text-emerald-600 mr-1" /> Approve
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { if (confirm('Permanently delete this user?')) deleteUser.mutate(user.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {suspendedUsers.length === 0 && <p className="text-muted-foreground text-center py-8">No suspended staff</p>}
        </TabsContent>
      </Tabs>

      {/* Edit Staff Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-brass" /> Edit Staff Profile
            </DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">{editUser.full_name}</p>
                <p className="text-xs text-muted-foreground">{editUser.role} · Joined {editUser.created_at ? format(new Date(editUser.created_at), 'MMM d, yyyy') : ''}</p>
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+254700000000" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button variant="brass" className="flex-1" onClick={() => editUserMutation.mutate({ id: editUser.id, ...editForm })} disabled={editUserMutation.isPending}>
                  {editUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
