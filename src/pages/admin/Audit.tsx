import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { Loader2, Activity, Shield, Eye, EyeOff } from 'lucide-react';

export default function AdminAudit() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Track all system activities and changes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs?.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No audit logs recorded yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                System activities will appear here as they occur
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.map((log: any) => {
                  const isImpersonateStart = log.action === 'impersonate_start';
                  const isImpersonateEnd = log.action === 'impersonate_end';
                  const isImpersonation = isImpersonateStart || isImpersonateEnd;
                  const nv = log.new_value || {};
                  const ov = log.old_value || {};

                  return (
                    <TableRow key={log.id} className={isImpersonation ? 'bg-amber-50/50' : ''}>
                      <TableCell className="whitespace-nowrap text-xs">
                        <div>{log.created_at ? format(new Date(log.created_at), 'MMM d, h:mm a') : ''}</div>
                        <div className="text-muted-foreground text-[10px]">
                          {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isImpersonation ? (
                          <Badge className={isImpersonateStart ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}>
                            {isImpersonateStart ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                            {isImpersonateStart ? 'Impersonation Started' : 'Impersonation Ended'}
                          </Badge>
                        ) : (
                          <span className="font-medium text-sm">{log.action}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {isImpersonation ? (
                          <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3 text-amber-500" />
                            users
                          </span>
                        ) : log.table_name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {isImpersonation ? (
                          <span>
                            <span className="font-medium">{nv.admin_email || 'Admin'}</span>
                            <span className="text-muted-foreground"> → </span>
                            <span className="font-medium">{nv.target_name}</span>
                            <Badge variant="outline" className="ml-1 text-[10px]">{nv.target_role}</Badge>
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">{log.user_id?.slice(0, 8) || 'system'}...</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-sm">
                        {isImpersonation ? (
                          <span className="text-sm text-muted-foreground">
                            {isImpersonateStart ? (
                              <>Started impersonating <strong>{nv.target_name}</strong> ({nv.target_role})</>
                            ) : (
                              <>Ended after <strong>{nv.duration_display || '—'}</strong></>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground truncate block">
                            {log.reason || (log.new_value ? Object.entries(log.new_value).slice(0, 2).map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`).join(', ') : '-')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
