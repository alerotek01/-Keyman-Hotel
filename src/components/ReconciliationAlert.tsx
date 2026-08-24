import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  AlertTriangle, Camera, Check, X, Loader2, FileText,
  Smartphone, Receipt, Send, MessageSquare, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function ReconciliationAlert() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const [proofType, setProofType] = useState<'mpesa_message' | 'receipt' | 'both'>('mpesa_message');
  const [proofFile, setProofFile] = useState<File | null>(null);

  // Fetch flagged reconciliations for this staff member
  const { data: flaggedRecons } = useQuery({
    queryKey: ['flagged-recons', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await sb
        .from('shift_reconciliations')
        .select(`
          *,
          staff_shifts!shift_id(user_id, shift_name, shift_date, departments:department_id(name))
        `)
        .eq('staff_shifts.user_id', user.id)
        .eq('status', 'flagged')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Mutation to submit explanation
  const submitExplanation = useMutation({
    mutationFn: async ({ reconId, explanation, proofType, proofFile }: {
      reconId: string;
      explanation: string;
      proofType: 'mpesa_message' | 'receipt' | 'both';
      proofFile?: File | null;
    }) => {
      let proofUrl: string | null = null;

      // Upload proof file if provided
      if (proofFile) {
        try {
          const ext = proofFile.name.split('.').pop() || 'jpg';
          const fileName = `receipts/variance/${reconId}/${Date.now()}.${ext}`;
          const { error: uploadErr } = await sb.storage
            .from('rooms')
            .upload(fileName, proofFile, { contentType: proofFile.type });
          if (!uploadErr) {
            const { data: urlData } = sb.storage.from('rooms').getPublicUrl(fileName);
            proofUrl = urlData.publicUrl;
          }
        } catch (e) {
          console.warn('Proof upload failed:', e);
        }
      }

      const { data: rec, error } = await sb
        .from('shift_reconciliations')
        .update({
          variance_status: 'staff_explained',
          variance_explanation: explanation,
          variance_proof_type: proofType,
          variance_proof_url: proofUrl,
          variance_resolved_at: new Date().toISOString(),
          status: 'explained',
        })
        .eq('id', reconId)
        .select()
        .single();
      if (error) throw error;

      // Notify manager/admin
      try {
        await sb.rpc('fire_notification', {
          p_title: 'Variance Explanation Received',
          p_body: `Staff has submitted an explanation for a flagged variance. Please review.`,
          p_type: 'reconciliation',
          p_roles: JSON.stringify(['admin', 'manager']),
        });
      } catch (e) { console.warn('Notification failed:', e); }

      return rec;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flagged-recons'] });
      qc.invalidateQueries({ queryKey: ['reconciliations'] });
      setExpanded(null);
      setExplanation('');
      setProofFile(null);
      toast.success('Explanation submitted — manager will review');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit');
    },
  });

  if (!flaggedRecons || flaggedRecons.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {flaggedRecons.map((recon: any) => {
        const isExpanded = expanded === recon.id;
        const variance = recon.variance;
        const isShort = variance < 0;

        return (
          <Card key={recon.id} className="border-l-4 border-l-red-500 bg-red-50/50">
            <CardContent className="p-4">
              {/* Alert Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-800">Reconciliation Flagged</p>
                    <p className="text-sm text-red-600 mt-0.5">
                      {recon.staff_shifts?.shift_name} shift · {recon.staff_shifts?.shift_date ? format(new Date(recon.staff_shifts.shift_date), 'MMM d') : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Variance: <strong className={isShort ? 'text-red-600' : 'text-emerald-600'}>
                        {variance >= 0 ? '+' : ''}KES {Math.abs(variance).toLocaleString()}
                      </strong> {isShort ? '(SHORT)' : '(OVER)'}
                    </p>
                  </div>
                </div>
                <Badge className="bg-red-100 text-red-700">⚠️ Needs Response</Badge>
              </div>

              {/* Manager's flag reason */}
              {recon.manager_notes && (
                <div className="mt-3 p-2 bg-white rounded border text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Manager's Note:</p>
                  <p className="italic text-gray-700">"{recon.manager_notes}"</p>
                </div>
              )}

              {/* Response Form */}
              {!isExpanded ? (
                <Button
                  variant="outline"
                  className="mt-3 w-full text-red-600 border-red-200 hover:bg-red-100"
                  onClick={() => setExpanded(recon.id)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Respond with Explanation & Proof
                </Button>
              ) : (
                <div className="mt-3 space-y-3 p-3 bg-white rounded-lg border">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Explanation *</Label>
                    <Textarea
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      placeholder={isShort
                        ? "e.g. Gave wrong change of KES 50 to walk-in customer at table 3..."
                        : "e.g. Received a tip of KES 100 that wasn't recorded in the system..."}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Proof Type</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={proofType === 'mpesa_message' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setProofType('mpesa_message')}
                      >
                        <Smartphone className="mr-1 h-3 w-3" /> M-Pesa Message
                      </Button>
                      <Button
                        type="button"
                        variant={proofType === 'receipt' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setProofType('receipt')}
                      >
                        <Receipt className="mr-1 h-3 w-3" /> Receipt
                      </Button>
                      <Button
                        type="button"
                        variant={proofType === 'both' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setProofType('both')}
                      >
                        <FileText className="mr-1 h-3 w-3" /> Both
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Upload Proof</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    />
                    {proofFile && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600">
                        <Check className="h-3 w-3" />
                        {proofFile.name}
                        <Button variant="ghost" size="sm" className="h-5 px-1" onClick={() => setProofFile(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Take a screenshot of the M-Pesa confirmation or photo of receipt
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setExpanded(null); setExplanation(''); setProofFile(null); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        if (!explanation.trim()) {
                          toast.error('Please provide an explanation');
                          return;
                        }
                        submitExplanation.mutate({
                          reconId: recon.id,
                          explanation: explanation.trim(),
                          proofType,
                          proofFile,
                        });
                      }}
                      disabled={submitExplanation.isPending || !explanation.trim()}
                    >
                      {submitExplanation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Submit Explanation
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
