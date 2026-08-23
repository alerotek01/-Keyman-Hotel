import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Settings, CreditCard, Clock, Shield, Save, AlertTriangle } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface Setting {
  key: string;
  value: string;
}

const DEFAULT_SETTINGS: Record<string, string> = {
  reservation_deposit_percent: '50',
  cancellation_policy_hours: '24',
  cancellation_penalty_percent: '100',
  same_day_pay_threshold_hours: '12',
  mpesa_paybill_number: '',
  mpesa_account_reference: 'ROOM-{room_number}',
  min_stay_for_deposit_nights: '2',
  card_pay_enabled: 'false',
};

export default function BookingSettings() {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data } = await sb.from('site_settings').select('*');
      const map = { ...DEFAULT_SETTINGS };
      (data || []).forEach((s: Setting) => { map[s.key] = s.value; });
      setSettings(map);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
      // Upsert each setting
      for (const row of rows) {
        await sb.from('site_settings').upsert(row, { onConflict: 'key' });
      }
      toast.success('Settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-brass" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-brass" />
            Booking & Payment Settings
          </h2>
          <p className="text-muted-foreground mt-1">Configure booking rules, payment methods, and cancellation policies</p>
        </div>
        <Button variant="brass" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-brass" />
              Payment Rules
            </CardTitle>
            <CardDescription>When guests must pay and how much</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Same-Day Pay Threshold (hours)</Label>
              <Input
                type="number"
                value={settings.same_day_pay_threshold_hours}
                onChange={e => updateSetting('same_day_pay_threshold_hours', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Bookings within this many hours of check-in require full payment now</p>
            </div>

            <div className="space-y-2">
              <Label>Reservation Deposit (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.reservation_deposit_percent}
                onChange={e => updateSetting('reservation_deposit_percent', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Percentage of total for stays ≥ {settings.min_stay_for_deposit_nights} nights</p>
            </div>

            <div className="space-y-2">
              <Label>Min Stay for Deposit (nights)</Label>
              <Input
                type="number"
                min={1}
                value={settings.min_stay_for_deposit_nights}
                onChange={e => updateSetting('min_stay_for_deposit_nights', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Stays shorter than this pay on arrival; longer stays require deposit</p>
            </div>
          </CardContent>
        </Card>

        {/* Cancellation Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Cancellation Policy
            </CardTitle>
            <CardDescription>Penalty rules for cancellations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Free Cancellation Window (hours before check-in)</Label>
              <Input
                type="number"
                min={0}
                value={settings.cancellation_policy_hours}
                onChange={e => updateSetting('cancellation_policy_hours', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Guests can cancel free within this window</p>
            </div>

            <div className="space-y-2">
              <Label>Cancellation Penalty (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.cancellation_penalty_percent}
                onChange={e => updateSetting('cancellation_penalty_percent', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Percentage charged for late cancellations</p>
            </div>

            {parseInt(settings.cancellation_penalty_percent) > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Policy Active</p>
                    <p className="text-xs text-amber-600">
                      Late cancellations (within {settings.cancellation_policy_hours}h) will incur a {settings.cancellation_penalty_percent}% penalty.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* M-Pesa Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-500" />
              M-Pesa Configuration
            </CardTitle>
            <CardDescription>Manual M-Pesa payment confirmation settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Paybill Number</Label>
              <Input
                type="text"
                placeholder="e.g., 123456"
                value={settings.mpesa_paybill_number}
                onChange={e => updateSetting('mpesa_paybill_number', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Business paybill number for M-Pesa payments</p>
            </div>

            <div className="space-y-2">
              <Label>Account Reference Format</Label>
              <Input
                type="text"
                placeholder="ROOM-{room_number}"
                value={settings.mpesa_account_reference}
                onChange={e => updateSetting('mpesa_account_reference', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Use {'{room_number}'} and {'{reservation_id}'} as placeholders</p>
            </div>

            {settings.mpesa_paybill_number && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-sm font-medium text-emerald-800">📱 M-Pesa Payment Instructions</p>
                <p className="text-xs text-emerald-600 mt-1">
                  Guests will be told to send payment to Paybill <strong>{settings.mpesa_paybill_number}</strong> with account reference.
                  Admin must manually confirm each payment in the Payment Verification panel.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card Payment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-500" />
              Card Payment
            </CardTitle>
            <CardDescription>Credit/debit card processing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div>
                <p className="text-sm font-medium text-blue-800">Card Payment Gateway</p>
                <p className="text-xs text-blue-600">Stripe integration — coming soon</p>
              </div>
              <Badge variant="outline" className="bg-blue-100 text-blue-700">Coming Soon</Badge>
            </div>

            <div className="space-y-2">
              <Label>Enable Card Payment</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={settings.card_pay_enabled}
                onChange={e => updateSetting('card_pay_enabled', e.target.value)}
              >
                <option value="false">Disabled</option>
                <option value="true">Enabled</option>
              </select>
              <p className="text-xs text-muted-foreground">Enable when Stripe integration is ready</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Rules Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Payment Rules Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="font-semibold text-red-800">⚡ Same-Day Booking</p>
              <p className="text-xs text-red-600 mt-1">
                Check-in {'<'} {settings.same_day_pay_threshold_hours}h away → <strong>Pay Now (100%)</strong> mandatory
              </p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="font-semibold text-amber-800">💰 Long Stay (≥{settings.min_stay_for_deposit_nights} nights)</p>
              <p className="text-xs text-amber-600 mt-1">
                Pay <strong>{settings.reservation_deposit_percent}% deposit</strong> now, balance at check-in
              </p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="font-semibold text-emerald-800">✅ Short Stay ({'<'} {settings.min_stay_for_deposit_nights} nights, {'>'} {settings.same_day_pay_threshold_hours}h)</p>
              <p className="text-xs text-emerald-600 mt-1">
                <strong>Pay on Arrival</strong> — no upfront payment
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Badge component (simple inline for settings page)
function Badge({ children, variant, className }: { children: React.ReactNode; variant?: string; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className || ''}`}>{children}</span>;
}
