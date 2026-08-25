import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useCampaigns, useCreateCampaign, useToggleCampaign, useDeleteCampaign, Campaign } from '@/hooks/useCampaigns';
import { useAllGuestsLoyalty } from '@/hooks/useLoyalty';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pause, Play, Trash2, Send, Mail, MessageSquare, Eye, BarChart3 } from 'lucide-react';

const CAMPAIGN_TYPES = [
  { value: 'occupancy', label: '🎯 Low Occupancy' },
  { value: 'winback', label: '💝 Win-Back' },
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'referral', label: '🤝 Referral' },
  { value: 'seasonal', label: '🌤️ Seasonal' },
  { value: 'points_reminder', label: '⭐ Points Reminder' },
  { value: 'custom', label: '✉️ Custom' },
];

const CHANNELS = [
  { value: 'email', label: '📧 Email' },
  { value: 'sms', label: '📱 SMS' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'in_app', label: '🔔 In-App' },
];

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  sent: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function CampaignManager() {
  const { data: campaigns, isLoading } = useCampaigns();
  const { data: guests } = useAllGuestsLoyalty();
  const createCampaign = useCreateCampaign();
  const toggleCampaign = useToggleCampaign();
  const deleteCampaign = useDeleteCampaign();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'custom',
    subject: '',
    body: '',
    channel: 'email',
    scheduled_at: '',
  });

  const handleCreate = async () => {
    if (!form.name || !form.subject || !form.body) {
      toast({ title: 'Missing fields', description: 'Name, subject, and body are required', variant: 'destructive' });
      return;
    }
    try {
      await createCampaign.mutateAsync({
        ...form,
        status: form.scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: form.scheduled_at || null,
        target_filter: {},
        target_guests_count: guests?.length ?? 0,
      } as any);
      toast({ title: '✅ Campaign created' });
      setShowCreate(false);
      setForm({ name: '', type: 'custom', subject: '', body: '', channel: 'email', scheduled_at: '' });
    } catch (err: any) {
      toast({ title: '❌ Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const newStatus = await toggleCampaign.mutateAsync(id);
      toast({ title: `Campaign ${newStatus === 'paused' ? 'paused' : 'resumed'}` });
    } catch (err: any) {
      toast({ title: '❌ Toggle failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign permanently?')) return;
    try {
      await deleteCampaign.mutateAsync(id);
      toast({ title: 'Campaign deleted' });
    } catch (err: any) {
      toast({ title: '❌ Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaign Manager</h1>
          <p className="text-muted-foreground">Create and manage email, SMS, and notification campaigns</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input
                  placeholder="e.g., Weekend Flash Sale"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select value={form.channel} onValueChange={(v) => setForm(f => ({ ...f, channel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  placeholder="e.g., 20% off this weekend at Keyman Hotel"
                  value={form.subject}
                  onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Message Body</Label>
                <Textarea
                  rows={5}
                  placeholder="Dear {guest_name},\n\nWe'd love to see you again..."
                  value={form.body}
                  onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Use {'{guest_name}'}, {'{points_balance}'}, {'{tier}'} for personalization
                </p>
              </div>
              <div className="space-y-2">
                <Label>Schedule (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Leave empty to save as draft</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createCampaign.isPending}>
                  {createCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Campaign
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{campaigns?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total Campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{campaigns?.filter(c => c.status === 'sent').length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{campaigns?.filter(c => c.status === 'scheduled').length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{campaigns?.filter(c => c.status === 'paused').length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Paused</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign List */}
      <div className="space-y-3">
        {campaigns?.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No campaigns yet</p>
              <p className="text-sm">Create your first campaign to start engaging guests</p>
            </CardContent>
          </Card>
        )}

        {campaigns?.map(campaign => (
          <Card key={campaign.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{campaign.name}</h3>
                    <Badge className={statusColors[campaign.status] || ''}>
                      {campaign.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {CAMPAIGN_TYPES.find(t => t.value === campaign.type)?.label ?? campaign.type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {CHANNELS.find(c => c.value === campaign.channel)?.label ?? campaign.channel}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{campaign.subject}</p>
                  {campaign.scheduled_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      📅 Scheduled: {new Date(campaign.scheduled_at).toLocaleString()}
                    </p>
                  )}
                  {campaign.sent_at && (
                    <p className="text-xs text-green-600 mt-1">
                      ✅ Sent: {new Date(campaign.sent_at).toLocaleString()} · {campaign.sent_count} recipients
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Analytics (if sent) */}
                  {campaign.status === 'sent' && (
                    <div className="flex items-center gap-3 mr-4 text-xs text-muted-foreground">
                      <span title="Opened"><Eye className="h-3.5 w-3.5 inline" /> {campaign.open_count}</span>
                      <span title="Clicked"><BarChart3 className="h-3.5 w-3.5 inline" /> {campaign.click_count}</span>
                    </div>
                  )}

                  {/* Pause / Resume */}
                  {(campaign.status === 'scheduled' || campaign.status === 'paused' || campaign.status === 'draft') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(campaign.id)}
                      disabled={toggleCampaign.isPending}
                    >
                      {campaign.status === 'paused' ? (
                        <><Play className="h-3.5 w-3.5 mr-1" /> Resume</>
                      ) : (
                        <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</>
                      )}
                    </Button>
                  )}

                  {/* Delete */}
                  {(campaign.status === 'draft' || campaign.status === 'paused' || campaign.status === 'cancelled') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(campaign.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
