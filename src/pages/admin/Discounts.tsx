import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDiscountCodes, useCreateDiscountCode, useUpdateDiscountCode, useDeleteDiscountCode, DiscountCode } from '@/hooks/useDiscounts';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Edit, Tag, Percent, DollarSign, ToggleLeft, ToggleRight, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Discounts() {
  const { user } = useAuth();
  const { data: codes, isLoading } = useDiscountCodes();
  const createCode = useCreateDiscountCode();
  const updateCode = useUpdateDiscountCode();
  const deleteCode = useDeleteDiscountCode();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [form, setForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    applies_to: 'both' as 'rooms' | 'kitchen' | 'both',
    min_amount: '0',
    max_uses: '',
    valid_from: '',
    valid_until: '',
    is_active: true,
  });

  const resetForm = () => {
    setForm({
      code: '', description: '', discount_type: 'percentage', discount_value: '',
      applies_to: 'both', min_amount: '0', max_uses: '', valid_from: '', valid_until: '', is_active: true,
    });
    setEditingCode(null);
  };

  const openCreate = () => {
    resetForm();
    setForm(prev => ({ ...prev, valid_from: new Date().toISOString().slice(0, 16) }));
    setDialogOpen(true);
  };

  const openEdit = (code: DiscountCode) => {
    setEditingCode(code);
    setForm({
      code: code.code,
      description: code.description || '',
      discount_type: code.discount_type,
      discount_value: code.discount_value.toString(),
      applies_to: code.applies_to,
      min_amount: code.min_amount.toString(),
      max_uses: code.max_uses?.toString() || '',
      valid_from: code.valid_from ? new Date(code.valid_from).toISOString().slice(0, 16) : '',
      valid_until: code.valid_until ? new Date(code.valid_until).toISOString().slice(0, 16) : '',
      is_active: code.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim()) { toast.error('Code is required'); return; }
    if (!form.discount_value || Number(form.discount_value) <= 0) { toast.error('Discount value must be positive'); return; }
    if (form.discount_type === 'percentage' && Number(form.discount_value) > 100) { toast.error('Percentage cannot exceed 100%'); return; }

    try {
      const data = {
        code: form.code.toUpperCase().trim(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        applies_to: form.applies_to,
        min_amount: Number(form.min_amount) || 0,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : new Date().toISOString(),
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        is_active: form.is_active,
        created_by: user?.id || null,
      };

      if (editingCode) {
        await updateCode.mutateAsync({ id: editingCode.id, ...data });
        toast.success('Discount code updated');
      } else {
        await createCode.mutateAsync(data);
        toast.success('Discount code created');
      }
      setDialogOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete discount code "${code}"?`)) return;
    try {
      await deleteCode.mutateAsync(id);
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    }
  };

  const handleToggle = async (code: DiscountCode) => {
    try {
      await updateCode.mutateAsync({ id: code.id, is_active: !code.is_active });
      toast.success(code.is_active ? 'Deactivated' : 'Activated');
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    }
  };

  const activeCodes = codes?.filter(c => c.is_active) || [];
  const totalUses = codes?.reduce((s, c) => s + c.used_count, 0) || 0;

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-brass" /></div>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Discount Codes</h1>
          <p className="text-muted-foreground">Manage promotions for rooms and kitchen</p>
        </div>
        <Button variant="brass" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New Code
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total Codes</p>
          <p className="text-2xl font-bold">{codes?.length || 0}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-emerald-600">{activeCodes.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total Uses</p>
          <p className="text-2xl font-bold text-blue-600">{totalUses}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Expired</p>
          <p className="text-2xl font-bold text-muted-foreground">{codes?.filter(c => c.valid_until && new Date(c.valid_until) < new Date()).length || 0}</p>
        </CardContent></Card>
      </div>

      {/* Codes list */}
      <div className="space-y-3">
        {!codes || codes.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No discount codes yet</p>
            <Button variant="brass" className="mt-4" onClick={openCreate}>Create First Code</Button>
          </div>
        ) : codes.map(code => {
          const isExpired = code.valid_until && new Date(code.valid_until) < new Date();
          return (
            <Card key={code.id} className={cn(!code.is_active && 'opacity-60')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm",
                      code.discount_type === 'percentage' ? 'bg-blue-600' : 'bg-emerald-600'
                    )}>
                      {code.discount_type === 'percentage' ? `${code.discount_value}%` : `KES${code.discount_value}`}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-bold text-lg">{code.code}</p>
                        <Badge variant="outline" className="text-xs">
                          {code.applies_to === 'both' ? '🍽️ Rooms + Kitchen' : code.applies_to === 'rooms' ? '🛏️ Rooms' : '🍽️ Kitchen'}
                        </Badge>
                        {isExpired && <Badge className="bg-red-100 text-red-800 text-xs">Expired</Badge>}
                        {!code.is_active && <Badge className="bg-gray-100 text-gray-800 text-xs">Inactive</Badge>}
                      </div>
                      {code.description && <p className="text-sm text-muted-foreground">{code.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        Used {code.used_count}{code.max_uses ? ` / ${code.max_uses}` : ' times'}
                        {code.min_amount > 0 ? ` · Min KES ${code.min_amount}` : ''}
                        {code.valid_until ? ` · Expires ${format(new Date(code.valid_until), 'MMM d, yyyy')}` : ' · No expiry'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleToggle(code)}>
                      {code.is_active ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(code)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(code.id, code.code)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCode ? 'Edit Discount Code' : 'New Discount Code'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SUMMER20" className="font-mono uppercase" />
              </div>
              <div className="space-y-2">
                <Label>Applies To *</Label>
                <Select value={form.applies_to} onValueChange={v => setForm({ ...form, applies_to: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">🍽️ Rooms + Kitchen</SelectItem>
                    <SelectItem value="rooms">🛏️ Rooms Only</SelectItem>
                    <SelectItem value="kitchen">🍳 Kitchen Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. 20% off for returning guests" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type *</Label>
                <Select value={form.discount_type} onValueChange={v => setForm({ ...form, discount_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage"><Percent className="inline h-3 w-3 mr-1" /> Percentage</SelectItem>
                    <SelectItem value="fixed"><DollarSign className="inline h-3 w-3 mr-1" /> Fixed Amount (KES)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{form.discount_type === 'percentage' ? 'Percentage Off' : 'Amount Off (KES)'} *</Label>
                <Input type="number" step="0.01" min="0" max={form.discount_type === 'percentage' ? '100' : undefined}
                  value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Order (KES)</Label>
                <Input type="number" step="0.01" min="0" value={form.min_amount}
                  onChange={e => setForm({ ...form, min_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Max Uses (blank = unlimited)</Label>
                <Input type="number" min="1" value={form.max_uses}
                  onChange={e => setForm({ ...form, max_uses: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input type="datetime-local" value={form.valid_from}
                  onChange={e => setForm({ ...form, valid_from: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Valid Until (blank = no expiry)</Label>
                <Input type="datetime-local" value={form.valid_until}
                  onChange={e => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button variant="brass" className="flex-1" onClick={handleSubmit} disabled={createCode.isPending || updateCode.isPending}>
                {(createCode.isPending || updateCode.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingCode ? 'Save Changes' : 'Create Code'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
