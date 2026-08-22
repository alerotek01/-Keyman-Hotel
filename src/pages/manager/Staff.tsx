import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, Shield, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  manager: 'bg-blue-100 text-blue-800',
  receptionist: 'bg-emerald-100 text-emerald-800',
  waiter: 'bg-orange-100 text-orange-800',
  chef: 'bg-purple-100 text-purple-800',
  housekeeper: 'bg-amber-100 text-amber-800',
  accountant: 'bg-teal-100 text-teal-800',
};

export default function StaffManagement() {
  const { data: staffMembers, isLoading } = useQuery({
    queryKey: ['staff-members'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const admins = staffMembers?.filter((s: any) => s.role === 'admin') || [];
  const managers = staffMembers?.filter((s: any) => s.role === 'manager') || [];
  const staff = staffMembers?.filter((s: any) => !['admin', 'manager'].includes(s.role)) || [];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Staff Management</h1>
        <p className="text-muted-foreground">View hotel staff members and their roles</p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>All Team Members</CardTitle>
          <CardDescription>Staff with system access</CardDescription>
        </CardHeader>
        <CardContent>
          {(staffMembers?.length || 0) === 0 ? (
            <p className="text-muted-foreground text-center py-8">No staff members found</p>
          ) : (
            <div className="space-y-3">
              {staffMembers?.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-brass/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-brass" />
                    </div>
                    <div>
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={cn(ROLE_COLORS[member.role] || 'bg-gray-100 text-gray-800')}>
                      {member.role}
                    </Badge>
                    {!member.is_active && <Badge variant="secondary">Suspended</Badge>}
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
