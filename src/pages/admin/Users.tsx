import { useState } from 'react';
import { logImpersonationStart } from '@/lib/audit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sendWelcomeEmail, sendStaffInviteOTP } from '@/lib/email';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Loader2, Plus, Shield, UserCog, UserX, UserCheck, Mail, Phone, Pencil, Trash2, Eye, BedDouble, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ROLES: { value: AppRole; label: string; color: string }[] = [
  { value: 'admin', label: 'Admin', color: 'bg-red-100 text-red-800' },
  { value: 'manager', label: 'Manager', color: 'bg-blue-100 text-blue-800' },
  { value: 'receptionist', label: 'Receptionist', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'waiter', label: 'Waiter', color: 'bg-orange-100 text-orange-800' },
  { value: 'chef', label: 'Chef', color: 'bg-purple-100 text-purple-800' },
  { value: 'housekeeper', label: 'Housekeeper', color: 'bg-amber-100 text-amber-800' },
  { value: 'accountant', label: 'Accountant', color: 'bg-teal-100 text-teal-800' },
];

export default function AdminUsers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ email: '', full_name: '', phone: '', role: 'receptionist' as AppRole, password: '' });

  // List all users
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Create user via Edge Function (proper auth credentials)
  const createUser = useMutation({
    mutationFn: async (data: { email: string; password: string; full_name: string; phone: string; role: AppRole }) => {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Get current session token
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password || null,
          full_name: data.full_name,
          phone: data.phone || '',
          role: data.role,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'User creation failed');
      }

      const tempPassword = result.temp_password;

      if (data.password) {
        // Password provided — send welcome email with credentials
        await sendWelcomeEmail(data.email, data.full_name, data.role, data.password);
      } else if (tempPassword) {
        // Auto-generated password — send welcome email with credentials
        await sendWelcomeEmail(data.email, data.full_name, data.role, tempPassword);
      } else {
        // No password — generate OTP and send invite code
        const { data: otpResult } = await sb.rpc('generate_and_store_otp', {
          p_email: data.email,
          p_purpose: 'staff_invite',
        });
        if (otpResult?.success) {
          await sendStaffInviteOTP(data.email, otpResult.code, data.full_name, data.role);
        }
      }

      return { id: result.user_id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: 'User Created', description: 'New staff account created successfully.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create user', variant: 'destructive' });
    },
  });

  // Update user role/status
  const updateUser = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; role?: AppRole; is_active?: boolean; full_name?: string; phone?: string }) => {
      const { error } = await sb
        .from('users')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setEditUser(null);
      toast({ title: 'User Updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Fetch guests for impersonation
  const { data: guests } = useQuery({
    queryKey: ['admin-guests'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('guests')
        .select('id, name, email, phone, created_at, user_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleImpersonateGuest = async (guest: any) => {
    if (!confirm(`Act as guest ${guest.name}? You'll see their dashboard.`)) return;
    const guestEmail = guest.email || `${guest.name.toLowerCase().replace(/\s+/g, '.')}@guest.local`;
    const auditLogId = await logImpersonationStart({
      adminId: user?.id || '',
      adminEmail: user?.email || '',
      targetUserId: guest.user_id || guest.id,
      targetName: guest.name,
      targetRole: 'guest',
      targetEmail: guestEmail,
    });
    localStorage.setItem('impersonate', JSON.stringify({
      targetUser: {
        id: guest.user_id || guest.id,
        email: guestEmail,
        full_name: guest.name,
        role: 'guest',
      },
      adminId: user?.id,
      adminEmail: user?.email,
      auditLogId,
      startedAt: new Date().toISOString(),
    }));
    window.location.href = '/guest';
  };

  const handleImpersonateCustomer = async (customer: any) => {
    if (!confirm(`Act as customer ${customer.full_name || customer.email}? You'll see their café dashboard.`)) return;
    const auditLogId = await logImpersonationStart({
      adminId: user?.id || '',
      adminEmail: user?.email || '',
      targetUserId: customer.id,
      targetName: customer.full_name || customer.email,
      targetRole: 'external_customer',
      targetEmail: customer.email,
    });
    localStorage.setItem('impersonate', JSON.stringify({
      targetUser: {
        id: customer.id,
        email: customer.email,
        full_name: customer.full_name || customer.email,
        role: 'external_customer',
      },
      adminId: user?.id,
      adminEmail: user?.email,
      auditLogId,
      startedAt: new Date().toISOString(),
    }));
    window.location.href = '/external';
  };

  // Delete user (with variance check)
  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      // Check for pending variance first
      const { data: varianceCheck, error: checkError } = await sb.rpc('check_user_variance', {
        p_user_id: userId,
      });
      if (checkError) throw checkError;

      if (!varianceCheck?.can_delete) {
        throw new Error(
          `Cannot delete: this user has ${varianceCheck?.pending_variance} pending reconciliation(s) with variance. Please resolve the variance or suspend the account instead.`
        );
      }

      // Safe to delete
      const { error } = await sb.from('users').delete().eq('id', userId);
      if (error) throw error;
      return varianceCheck;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'User Removed' });
    },
  });

  const resetForm = () => setForm({ email: '', full_name: '', phone: '', role: 'receptionist', password: '' });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate(form);
  };

  const handleSuspend = (user: any) => {
    if (!confirm(`Suspend ${user.full_name}? They won't be able to log in.`)) return;
    updateUser.mutate({ id: user.id, is_active: false });
  };

  const handleImpersonate = async (targetUser: any) => {
    if (!confirm(`Act as ${targetUser.full_name} (${targetUser.role})? You'll see their dashboard.`)) return;
    const auditLogId = await logImpersonationStart({
      adminId: user?.id || '',
      adminEmail: user?.email || '',
      targetUserId: targetUser.id,
      targetName: targetUser.full_name || targetUser.email,
      targetRole: targetUser.role,
      targetEmail: targetUser.email,
    });
    localStorage.setItem('impersonate', JSON.stringify({
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        full_name: targetUser.full_name,
        role: targetUser.role,
      },
      adminId: user?.id,
      adminEmail: user?.email,
      auditLogId,
      startedAt: new Date().toISOString(),
    }));
    // Route to the correct dashboard
    const ROLE_PATHS: Record<string, string> = {
      admin: '/admin', manager: '/manager', receptionist: '/staff',
      waiter: '/staff', chef: '/staff', housekeeper: '/staff',
      accountant: '/admin', guest: '/guest', external_customer: '/external/order',
    };
    window.location.href = ROLE_PATHS[targetUser.role] || '/staff';
  };

  const handleApprove = (user: any) => {
    updateUser.mutate({ id: user.id, is_active: true });
  };

  const handleRoleChange = (userId: string, newRole: AppRole) => {
    updateUser.mutate({ id: userId, role: newRole });
  };

  const getRoleInfo = (role: string) => ROLES.find(r => r.value === role) || ROLES[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const STAFF_ROLES = ['admin', 'manager', 'receptionist', 'waiter', 'chef', 'housekeeper', 'accountant'];
  const activeUsers = users?.filter((u: any) => u.is_active && STAFF_ROLES.includes(u.role)) || [];
  const suspendedUsers = users?.filter((u: any) => !u.is_active && STAFF_ROLES.includes(u.role)) || [];
  const customers = users?.filter((u: any) => u.role === 'external_customer') || [];

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Create, suspend, and manage staff accounts</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="brass" onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Staff Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
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
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} placeholder="Leave blank to send set-password link" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>                <Button type="submit" variant="brass" className="w-full" disabled={createUser.isPending}>
                  {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {form.password ? 'Create Account' : 'Create & Send Invite'}
                </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{users?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-emerald-600">{activeUsers.length}</p>
            <p className="text-xs text-muted-foreground">Staff</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-pink-600">{guests?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Guests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-amber-600">{customers.length}</p>
            <p className="text-xs text-muted-foreground">Customers</p>
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
          <TabsTrigger value="active">Staff ({activeUsers.length})</TabsTrigger>
          <TabsTrigger value="suspended">Suspended ({suspendedUsers.length})</TabsTrigger>
          <TabsTrigger value="guests">Guests ({guests?.length || 0})</TabsTrigger>
          <TabsTrigger value="customers">Customers ({customers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3 mt-4">
          {activeUsers.map((user: any) => {
            const roleInfo = getRoleInfo(user.role);
            return (
              <Card key={user.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-brass/10 flex items-center justify-center">
                      <UserCog className="h-5 w-5 text-brass" />
                    </div>
                    <div>
                      <p className="font-medium">{user.full_name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{user.email}</span>
                        {user.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{user.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={user.role} onValueChange={(v) => handleRoleChange(user.id, v as AppRole)}>
                      <SelectTrigger className="w-36 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge className={cn(roleInfo.color)}>{roleInfo.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : ''}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => handleSuspend(user)} title="Suspend user">
                      <UserX className="h-4 w-4 text-amber-600" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleImpersonate(user)} title="Act as this user">
                      <Eye className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      title="Delete user"
                      onClick={() => {
                        if (confirm(`Permanently delete ${user.full_name || user.email}?\n\nThis will check for any outstanding reconciliation variances first.`)) {
                          deleteUser.mutate(user.id, {
                            onError: (error: any) => {
                              toast({
                                title: 'Cannot Delete',
                                description: error.message,
                                variant: 'destructive',
                              });
                            },
                          });
                        }
                      }}
                      disabled={deleteUser.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {activeUsers.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No active users</p>
          )}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Permanently delete ${user.full_name || user.email}?\n\nThis will check for any outstanding reconciliation variances first.`)) {
                          deleteUser.mutate(user.id, {
                            onError: (error: any) => {
                              toast({
                                title: 'Cannot Delete',
                                description: error.message,
                                variant: 'destructive',
                              });
                            },
                          });
                        }
                      }}
                      disabled={deleteUser.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {suspendedUsers.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No suspended users</p>
          )}
        </TabsContent>
        <TabsContent value="guests" className="space-y-3 mt-4">
          {guests?.map((guest: any) => (
            <Card key={guest.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                    <BedDouble className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="font-medium">{guest.name}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {guest.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{guest.email}</span>}
                      {guest.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{guest.phone}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-pink-100 text-pink-800">Guest</Badge>
                  <span className="text-xs text-muted-foreground">
                    {guest.created_at ? format(new Date(guest.created_at), 'MMM d, yyyy') : ''}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => handleImpersonateGuest(guest)} title="Act as this guest">
                    <Eye className="h-4 w-4 text-blue-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!guests || guests.length === 0) && (
            <p className="text-muted-foreground text-center py-8">No guests registered</p>
          )}
        </TabsContent>
        <TabsContent value="customers" className="space-y-3 mt-4">
          {customers.length === 0 ? (
            <div className="text-center py-12">
              <Coffee className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No external customers yet</p>
              <p className="text-xs text-muted-foreground mt-1">Customers register via the Café login page</p>
            </div>
          ) : (
            customers.map((customer: any) => (
              <Card key={customer.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Coffee className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">{customer.full_name || customer.email?.split('@')[0]}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email}</span>
                        {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-amber-100 text-amber-800">Customer</Badge>
                    <span className="text-xs text-muted-foreground">
                      {customer.created_at ? format(new Date(customer.created_at), 'MMM d, yyyy') : ''}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => handleImpersonateCustomer(customer)} title="Act as this customer">
                      <Eye className="h-4 w-4 text-blue-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
