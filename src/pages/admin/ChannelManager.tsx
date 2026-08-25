import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Link2, RefreshCw, Download, Upload, AlertTriangle, CheckCircle2,
  Plus, Trash2, Settings, Wifi, WifiOff, Clock, ArrowRightLeft, Hotel,
  ExternalLink, Eye, EyeOff, Zap, BarChart3
} from "lucide-react";
import {
  useChannels, useUpdateChannel,
  useChannelMappings, useCreateMapping, useUpdateMapping, useDeleteMapping,
  useSyncLog, useTriggerSync,
  useChannelBookings, useChannelSyncSummary,
  useRoomTypesForMapping,
} from "@/hooks/useChannelManager";

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-100 text-green-700',
  disconnected: 'bg-gray-100 text-gray-700',
  error: 'bg-red-100 text-red-700',
  testing: 'bg-yellow-100 text-yellow-700',
};

const CHANNEL_ICONS: Record<string, string> = {
  booking_com: '🏨',
  expedia: '🌐',
  airbnb: '🏠',
  google_hotels: '📍',
  tripadvisor: '🗺️',
};

const SYNC_TYPE_LABELS: Record<string, string> = {
  rate_push: '📤 Rate Push',
  availability_push: '📤 Availability Push',
  booking_pull: '📥 Booking Pull',
  status_push: '📤 Status Push',
  full_sync: '🔄 Full Sync',
};

// ═══════════════════════════════════════════════════
// CHANNELS OVERVIEW
// ═══════════════════════════════════════════════════
function ChannelsOverview() {
  const { data: channels = [], isLoading } = useChannels();
  const updateChannel = useUpdateChannel();
  const { toast } = useToast();
  const [showConfig, setShowConfig] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState({ api_key: '', api_secret: '', hotel_id: '' });

  const handleConnect = async (channel: any) => {
    try {
      await updateChannel.mutateAsync({
        id: channel.id,
        status: 'connected',
        api_key_encrypted: configForm.hotel_id || channel.api_key_encrypted,
        api_secret_encrypted: configForm.api_secret || channel.api_secret_encrypted,
      });
      toast({ title: `${channel.name} connected!` });
      setShowConfig(null);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message });
    }
  };

  const handleDisconnect = async (channel: any) => {
    await updateChannel.mutateAsync({ id: channel.id, status: 'disconnected' });
    toast({ title: `${channel.name} disconnected` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Connected Channels</h3>
          <p className="text-sm text-muted-foreground">Manage your OTA connections. Connect to push rates & availability, pull bookings.</p>
        </div>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {channels.map(ch => (
            <Card key={ch.id} className={ch.status === 'connected' ? 'border-green-300' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{CHANNEL_ICONS[ch.code] || '🌐'}</span>
                    <div>
                      <div className="font-semibold">{ch.name}</div>
                      <Badge className={STATUS_COLORS[ch.status] || 'bg-gray-100'}>
                        {ch.status === 'connected' ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                        {ch.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Auto-sync rates:</span>
                    <Switch checked={ch.auto_sync_rates}
                      onCheckedChange={(v) => updateChannel.mutateAsync({ id: ch.id, auto_sync_rates: v })} />
                  </div>
                  <div className="flex justify-between">
                    <span>Auto-sync availability:</span>
                    <Switch checked={ch.auto_sync_availability}
                      onCheckedChange={(v) => updateChannel.mutateAsync({ id: ch.id, auto_sync_availability: v })} />
                  </div>
                  <div className="flex justify-between">
                    <span>Auto-pull bookings:</span>
                    <Switch checked={ch.auto_pull_bookings}
                      onCheckedChange={(v) => updateChannel.mutateAsync({ id: ch.id, auto_pull_bookings: v })} />
                  </div>
                  <div className="flex justify-between">
                    <span>Sync interval:</span>
                    <Select value={String(ch.sync_interval_minutes)}
                      onValueChange={(v) => updateChannel.mutateAsync({ id: ch.id, sync_interval_minutes: Number(v) })}>
                      <SelectTrigger className="w-24 h-7"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="360">6 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {ch.last_sync_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last sync: {new Date(ch.last_sync_at).toLocaleString()}
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  {ch.status === 'connected' ? (
                    <>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDisconnect(ch)}>
                        Disconnect
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowConfig(ch.id)}>
                        <Settings className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="flex-1" onClick={() => setShowConfig(ch.id)}>
                      <Link2 className="w-4 h-4 mr-1" /> Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Connection Config Dialog */}
      <Dialog open={!!showConfig} onOpenChange={() => setShowConfig(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {channels.find(c => c.id === showConfig)?.name}</DialogTitle>
            <DialogDescription>Enter your API credentials from the OTA's partner portal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Hotel/Property ID on OTA</Label>
              <Input placeholder="e.g. 6314570 (Booking.com property ID)"
                value={configForm.hotel_id}
                onChange={(e) => setConfigForm({ ...configForm, hotel_id: e.target.value })} />
            </div>
            <div>
              <Label>API Key / Client ID</Label>
              <Input placeholder="From OTA partner portal"
                value={configForm.api_key}
                onChange={(e) => setConfigForm({ ...configForm, api_key: e.target.value })} />
            </div>
            <div>
              <Label>API Secret / Client Secret</Label>
              <Input type="password" placeholder="Keep this secret"
                value={configForm.api_secret}
                onChange={(e) => setConfigForm({ ...configForm, api_secret: e.target.value })} />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Credentials are stored encrypted. In production, these should be managed via Supabase Vault.
            </div>
            <Button className="w-full" onClick={() => {
              const ch = channels.find(c => c.id === showConfig);
              if (ch) handleConnect(ch);
            }}>
              Save & Connect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ROOM MAPPINGS
// ═══════════════════════════════════════════════════
function RoomMappingsSection() {
  const { data: channels = [] } = useChannels();
  const [selectedChannel, setSelectedChannel] = useState('');
  const { data: mappings = [], isLoading } = useChannelMappings(selectedChannel);
  const { data: roomTypes = [] } = useRoomTypesForMapping();
  const createMapping = useCreateMapping();
  const updateMapping = useUpdateMapping();
  const deleteMapping = useDeleteMapping();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    room_type_id: '', ota_room_type_id: '', ota_room_name: '',
    ota_rate_plan_id: '', ota_rate_plan_name: '',
    rate_multiplier: 1.0, rate_offset: 0, ota_allotment: ''
  });

  const handleAdd = async () => {
    if (!selectedChannel || !form.room_type_id || !form.ota_room_type_id) {
      toast({ title: 'Missing fields', description: 'Select channel, room type, and enter OTA room type ID' });
      return;
    }
    try {
      await createMapping.mutateAsync({
        channel_id: selectedChannel,
        ...form,
        ota_allotment: form.ota_allotment ? Number(form.ota_allotment) : null,
      });
      toast({ title: 'Mapping created' });
      setShowAdd(false);
      setForm({ room_type_id: '', ota_room_type_id: '', ota_room_name: '', ota_rate_plan_id: '', ota_rate_plan_name: '', rate_multiplier: 1.0, rate_offset: 0, ota_allotment: '' });
    } catch (e: any) { toast({ title: 'Error', description: e.message }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Room Type Mappings</h3>
          <p className="text-sm text-muted-foreground">Map your room types to OTA room types. This determines what gets pushed to each channel.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm" disabled={!selectedChannel}>
          <Plus className="w-4 h-4 mr-1" /> Add Mapping
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
          <SelectTrigger className="w-60"><SelectValue placeholder="Select channel" /></SelectTrigger>
          <SelectContent>
            {channels.map(ch => (
              <SelectItem key={ch.id} value={ch.id}>{CHANNEL_ICONS[ch.code]} {ch.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedChannel ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Hotel className="w-8 h-8 mx-auto mb-2 opacity-50" />
          Select a channel above to manage room mappings.
        </CardContent></Card>
      ) : isLoading ? <p className="text-muted-foreground">Loading...</p> :
      mappings.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No room mappings for this channel. Add one to start syncing rates.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {mappings.map(m => {
            const rt = m.room_types;
            return (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">KEYMAN</div>
                        <div className="font-semibold">{rt?.name || 'Unknown'}</div>
                        <div className="text-xs">KES {rt?.base_rate}/night</div>
                      </div>
                      <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">OTA</div>
                        <div className="font-semibold">{m.ota_room_name || m.ota_room_type_id}</div>
                        <div className="text-xs">ID: {m.ota_room_type_id}</div>
                        {m.ota_rate_plan_id && <div className="text-xs">Plan: {m.ota_rate_plan_name || m.ota_rate_plan_id}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm">
                        <div>Multiplier: {m.rate_multiplier}x</div>
                        {m.rate_offset !== 0 && <div>Offset: KES {m.rate_offset}</div>}
                        {m.ota_allotment && <div>Allotment: {m.ota_allotment}</div>}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="sm" onClick={() => deleteMapping.mutate(m.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Room Mapping</DialogTitle>
            <DialogDescription>Map a Keyman room type to an OTA room type and rate plan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Keyman Room Type</Label>
              <Select value={form.room_type_id} onValueChange={(v) => setForm({ ...form, room_type_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
                <SelectContent>
                  {roomTypes.map(rt => (
                    <SelectItem key={rt.id} value={rt.id}>{rt.name} — KES {rt.base_rate}/night</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div><Label>OTA Room Type ID *</Label>
              <Input value={form.ota_room_type_id} onChange={(e) => setForm({ ...form, ota_room_type_id: e.target.value })}
                placeholder="e.g. 224 (from OTA extranet)" />
            </div>
            <div><Label>OTA Room Name</Label>
              <Input value={form.ota_room_name} onChange={(e) => setForm({ ...form, ota_room_name: e.target.value })}
                placeholder="e.g. Standard Single Room" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>OTA Rate Plan ID</Label>
                <Input value={form.ota_rate_plan_id} onChange={(e) => setForm({ ...form, ota_rate_plan_id: e.target.value })}
                  placeholder="e.g. 48901" />
              </div>
              <div><Label>OTA Rate Plan Name</Label>
                <Input value={form.ota_rate_plan_name} onChange={(e) => setForm({ ...form, ota_rate_plan_name: e.target.value })}
                  placeholder="e.g. Non-refundable" />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Rate Multiplier</Label>
                <Input type="number" step="0.01" min="0.5" max="2.0" value={form.rate_multiplier}
                  onChange={(e) => setForm({ ...form, rate_multiplier: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground mt-1">1.0 = same rate, 1.10 = 10% markup on OTA</p>
              </div>
              <div><Label>Rate Offset (KES)</Label>
                <Input type="number" value={form.rate_offset}
                  onChange={(e) => setForm({ ...form, rate_offset: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground mt-1">Fixed amount added/subtracted</p>
              </div>
            </div>
            <div><Label>OTA Allotment (max rooms to sell)</Label>
              <Input type="number" min={0} value={form.ota_allotment}
                onChange={(e) => setForm({ ...form, ota_allotment: e.target.value })}
                placeholder="Leave empty = all rooms" />
            </div>
            <Button onClick={handleAdd} className="w-full">Create Mapping</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SYNC OPERATIONS
// ═══════════════════════════════════════════════════
function SyncSection() {
  const { data: channels = [] } = useChannels();
  const [selectedChannel, setSelectedChannel] = useState('');
  const triggerSync = useTriggerSync();
  const { toast } = useToast();
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(futureDate);

  const handleSync = async (syncType: string) => {
    if (!selectedChannel) {
      toast({ title: 'Select a channel first' });
      return;
    }
    try {
      const result = await triggerSync.mutateAsync({
        channel_id: selectedChannel,
        sync_type: syncType,
        start_date: startDate,
        end_date: endDate,
      });
      const payload = result.payload as any;
      const count = syncType === 'rate_push' ? payload?.rates?.length : payload?.availability?.length;
      toast({
        title: 'Sync complete!',
        description: `${syncType === 'rate_push' ? 'Rates' : 'Availability'} synced: ${count || 0} entries for ${startDate} → ${endDate}`
      });
    } catch (e: any) {
      toast({ title: 'Sync failed', description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Sync Operations</h3>
        <p className="text-sm text-muted-foreground">Push rates and availability to your connected channels.</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div><Label>Channel</Label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                <SelectContent>
                  {channels.filter(c => c.status === 'connected').map(ch => (
                    <SelectItem key={ch.id} value={ch.id}>{CHANNEL_ICONS[ch.code]} {ch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><Label>End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => handleSync('rate_push')} disabled={triggerSync.isPending || !selectedChannel}>
              <Upload className="w-4 h-4 mr-1" /> Push Rates
            </Button>
            <Button onClick={() => handleSync('availability_push')} disabled={triggerSync.isPending || !selectedChannel} variant="outline">
              <Upload className="w-4 h-4 mr-1" /> Push Availability
            </Button>
            <Button onClick={() => handleSync('full_sync')} disabled={triggerSync.isPending || !selectedChannel} variant="outline">
              <RefreshCw className="w-4 h-4 mr-1" /> Full Sync
            </Button>
          </div>

          {triggerSync.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" /> Syncing...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SYNC LOG
// ═══════════════════════════════════════════════════
function SyncLogSection() {
  const { data: logs = [], isLoading } = useSyncLog(undefined, 100);
  const { data: channels = [] } = useChannels();
  const [filterChannel, setFilterChannel] = useState('all');

  const filteredLogs = filterChannel === 'all' ? logs : logs.filter(l => l.channel_id === filterChannel);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sync History</h3>
          <p className="text-sm text-muted-foreground">Log of all sync operations across channels.</p>
        </div>
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {channels.map(ch => (
              <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> :
      filteredLogs.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No sync operations yet. Connect a channel and push rates to get started.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map(log => (
            <div key={log.id} className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Badge className={log.status === 'success' ? 'bg-green-100 text-green-700' : log.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}>
                  {log.status === 'success' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                  {log.status}
                </Badge>
                <span className="text-sm font-medium">{SYNC_TYPE_LABELS[log.sync_type] || log.sync_type}</span>
                <span className="text-sm text-muted-foreground">{log.channels?.name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {log.room_types_synced > 0 && <span>{log.room_types_synced} types</span>}
                {log.dates_synced > 0 && <span>{log.dates_synced} dates</span>}
                {log.duration_ms && <span>{log.duration_ms}ms</span>}
                <span>{new Date(log.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// CHANNEL BOOKINGS
// ═══════════════════════════════════════════════════
function ChannelBookingsSection() {
  const { data: bookings = [], isLoading } = useChannelBookings();
  const { data: channels = [] } = useChannels();
  const [filterChannel, setFilterChannel] = useState('all');

  const filtered = filterChannel === 'all' ? bookings : bookings.filter(b => b.channel_id === filterChannel);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Channel Bookings</h3>
          <p className="text-sm text-muted-foreground">Bookings received from OTAs. Auto-linked to your reservations.</p>
        </div>
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {channels.map(ch => (
              <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> :
      filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Download className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No channel bookings yet. Bookings from connected OTAs will appear here.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(b => (
            <div key={b.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <div className="font-medium">{b.ota_guest_name || 'Guest'}</div>
                <div className="text-sm text-muted-foreground">
                  {b.channels?.name} • {b.check_in} → {b.check_out} • {b.room_types?.name}
                </div>
                <div className="text-xs text-muted-foreground">OTA ID: {b.ota_booking_id}</div>
              </div>
              <div className="text-right">
                <Badge className={b.sync_status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                  {b.sync_status}
                </Badge>
                <div className="text-sm mt-1">KES {b.ota_total || b.ota_rate}</div>
                {b.ota_commission && <div className="text-xs text-red-600">Commission: KES {b.ota_commission}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════
export default function ChannelManagerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="w-6 h-6" /> Channel Manager
        </h1>
        <p className="text-muted-foreground">
          Connect to Booking.com, Expedia, Airbnb and more. Push rates & availability, pull bookings automatically.
        </p>
      </div>

      <Tabs defaultValue="channels">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="channels"><Globe className="w-4 h-4 mr-1" /> Channels</TabsTrigger>
          <TabsTrigger value="mappings"><ArrowRightLeft className="w-4 h-4 mr-1" /> Room Mappings</TabsTrigger>
          <TabsTrigger value="sync"><RefreshCw className="w-4 h-4 mr-1" /> Sync</TabsTrigger>
          <TabsTrigger value="bookings"><Download className="w-4 h-4 mr-1" /> Bookings</TabsTrigger>
          <TabsTrigger value="log"><Clock className="w-4 h-4 mr-1" /> Sync Log</TabsTrigger>
        </TabsList>

        <TabsContent value="channels"><ChannelsOverview /></TabsContent>
        <TabsContent value="mappings"><RoomMappingsSection /></TabsContent>
        <TabsContent value="sync"><SyncSection /></TabsContent>
        <TabsContent value="bookings"><ChannelBookingsSection /></TabsContent>
        <TabsContent value="log"><SyncLogSection /></TabsContent>
      </Tabs>
    </div>
  );
}
