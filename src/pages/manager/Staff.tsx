import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, Shield, UserCog } from 'lucide-react';

interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

export default function StaffManagement() {
  const { data: staffMembers, isLoading } = useQuery({
    queryKey: ['staff-members'],
    queryFn: async (): Promise<StaffMember[]> => {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          *,
          profiles!user_roles_user_id_fkey (
            full_name,
            email
          )
        `)
        .in('role', ['staff', 'manager', 'admin'] as any)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as StaffMember[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Admin</Badge>;
      case 'manager':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Manager</Badge>;
      case 'staff':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Staff</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const admins = staffMembers?.filter(s => s.role === 'admin') || [];
  const managers = staffMembers?.filter(s => s.role === 'manager') || [];
  const staff = staffMembers?.filter(s => s.role === 'staff') || [];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Staff Management</h1>
        <p className="text-muted-foreground">View and manage hotel staff members</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Administrators</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{admins.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Managers</CardTitle>
            <UserCog className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{managers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Staff Members</CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{staff.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Staff List */}
      <Card>
        <CardHeader>
          <CardTitle>All Team Members</CardTitle>
          <CardDescription>Staff members with system access</CardDescription>
        </CardHeader>
        <CardContent>
          {(staffMembers?.length || 0) === 0 ? (
            <p className="text-muted-foreground text-center py-8">No staff members found</p>
          ) : (
            <div className="space-y-3">
              {staffMembers?.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-brass/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-brass" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {member.profiles?.full_name || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.profiles?.email || 'No email'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getRoleBadge(member.role)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <p className="text-amber-800">
            <strong>Note:</strong> To add or modify staff roles, please contact an administrator. 
            Role management is restricted to admin users for security purposes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
