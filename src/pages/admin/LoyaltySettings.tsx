import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useLoyaltySettings, useUpdateLoyaltySetting, useAllGuestsLoyalty } from '@/hooks/useLoyalty';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trophy, Star, Users, Gift, Settings } from 'lucide-react';

export default function LoyaltySettings() {
  const { data: settings, isLoading } = useLoyaltySettings();
  const { data: guests } = useAllGuestsLoyalty();
  const updateSetting = useUpdateLoyaltySetting();
  const { toast } = useToast();

  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        loyalty_enabled: settings.enabled ? 'true' : 'false',
        loyalty_points_value_kes: String(settings.points_value_kes),
        loyalty_earn_rate: String(settings.earn_rate),
        loyalty_direct_booking_bonus: String(settings.direct_booking_bonus),
        loyalty_restaurant_earn_rate: String(settings.restaurant_earn_rate),
        loyalty_review_bonus: String(settings.review_bonus),
        loyalty_birthday_multiplier: String(settings.birthday_multiplier),
        loyalty_returning_guest_multiplier: String(settings.returning_guest_multiplier),
        loyalty_referral_bonus_points: String(settings.referral_bonus_points),
        loyalty_referral_discount_percent: String(settings.referral_discount_percent),
        loyalty_tier_regular_threshold: String(settings.tier_regular_threshold),
        loyalty_tier_vip_threshold: String(settings.tier_vip_threshold),
        loyalty_tier_regular_multiplier: String(settings.tier_regular_multiplier),
        loyalty_tier_vip_multiplier: String(settings.tier_vip_multiplier),
        loyalty_points_expiry_months: String(settings.points_expiry_months),
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(form);
      for (const [key, value] of entries) {
        if (value !== undefined && value !== null) {
          await updateSetting.mutateAsync({ key, value });
        }
      }
      toast({ title: '✅ Loyalty settings saved', description: 'All changes applied successfully' });
    } catch (err: any) {
      toast({ title: '❌ Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const tierStats = {
    guest: guests?.filter(g => g.loyalty_tier === 'guest').length ?? 0,
    regular: guests?.filter(g => g.loyalty_tier === 'regular').length ?? 0,
    vip: guests?.filter(g => g.loyalty_tier === 'vip').length ?? 0,
    totalPoints: guests?.reduce((sum, g) => sum + (g.loyalty_points_balance ?? 0), 0) ?? 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loyalty Settings</h1>
          <p className="text-muted-foreground">Configure points, tiers, and referral rules</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save All Changes
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="h-6 w-6 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold">{tierStats.totalPoints.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Points Issued</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-6 w-6 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{guests?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Loyalty Members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-6 w-6 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{tierStats.vip}</p>
            <p className="text-xs text-muted-foreground">VIP Guests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Gift className="h-6 w-6 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{tierStats.regular}</p>
            <p className="text-xs text-muted-foreground">Regular Guests</p>
          </CardContent>
        </Card>
      </div>

      {/* Enable / Disable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Loyalty Program</Label>
              <p className="text-sm text-muted-foreground">Enable or disable the entire loyalty system</p>
            </div>
            <Switch
              checked={form.loyalty_enabled === 'true'}
              onCheckedChange={(checked) => updateField('loyalty_enabled', checked ? 'true' : 'false')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Point Value */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Point Value
          </CardTitle>
          <CardDescription>How much each point is worth in KES</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>1 Point = KES</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={form.loyalty_points_value_kes ?? ''}
                onChange={(e) => updateField('loyalty_points_value_kes', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                500 points = KES {(500 * parseFloat(form.loyalty_points_value_kes || '0.20')).toFixed(0)} off
              </p>
            </div>
            <div className="space-y-2">
              <Label>Points Expiry (months)</Label>
              <Input
                type="number"
                min="1"
                max="36"
                value={form.loyalty_points_expiry_months ?? ''}
                onChange={(e) => updateField('loyalty_points_expiry_months', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Points expire after this many months</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Redemption Examples</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>200 pts = KES {(200 * parseFloat(form.loyalty_points_value_kes || '0.20')).toFixed(0)} off (free breakfast)</p>
                <p>500 pts = KES {(500 * parseFloat(form.loyalty_points_value_kes || '0.20')).toFixed(0)} off (room discount)</p>
                <p>1000 pts = KES {(1000 * parseFloat(form.loyalty_points_value_kes || '0.20')).toFixed(0)} off (room upgrade)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Earn Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Earn Rules
          </CardTitle>
          <CardDescription>How guests earn points</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Stay Earn Rate (pts per KES 100 spent)</Label>
              <Input
                type="number"
                min="1"
                value={form.loyalty_earn_rate ?? ''}
                onChange={(e) => updateField('loyalty_earn_rate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Direct Booking Bonus (pts)</Label>
              <Input
                type="number"
                min="0"
                value={form.loyalty_direct_booking_bonus ?? ''}
                onChange={(e) => updateField('loyalty_direct_booking_bonus', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Restaurant Earn Rate (pts per KES 100 spent)</Label>
              <Input
                type="number"
                min="0"
                value={form.loyalty_restaurant_earn_rate ?? ''}
                onChange={(e) => updateField('loyalty_restaurant_earn_rate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Review Bonus (pts)</Label>
              <Input
                type="number"
                min="0"
                value={form.loyalty_review_bonus ?? ''}
                onChange={(e) => updateField('loyalty_review_bonus', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Birthday Month Multiplier</Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                value={form.loyalty_birthday_multiplier ?? ''}
                onChange={(e) => updateField('loyalty_birthday_multiplier', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">e.g., 2 = double points during birthday month</p>
            </div>
            <div className="space-y-2">
              <Label>Returning Guest Multiplier</Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                value={form.loyalty_returning_guest_multiplier ?? ''}
                onChange={(e) => updateField('loyalty_returning_guest_multiplier', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Multiplier for 3rd stay onwards</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Tier System
          </CardTitle>
          <CardDescription>When guests move up tiers and the bonus multiplier they receive</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <Badge variant="secondary" className="mb-2">🥉 Guest</Badge>
              <p className="text-sm text-muted-foreground">0 – {(parseInt(form.loyalty_tier_regular_threshold || '500') - 1).toLocaleString()} pts</p>
              <p className="text-sm font-medium mt-1">1.0x multiplier</p>
            </div>
            <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950">
              <Badge className="mb-2 bg-amber-500">🥈 Regular</Badge>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Threshold (pts)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.loyalty_tier_regular_threshold ?? ''}
                    onChange={(e) => updateField('loyalty_tier_regular_threshold', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Multiplier</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    value={form.loyalty_tier_regular_multiplier ?? ''}
                    onChange={(e) => updateField('loyalty_tier_regular_multiplier', e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
              <Badge className="mb-2 bg-yellow-500">🥇 VIP</Badge>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Threshold (pts)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.loyalty_tier_vip_threshold ?? ''}
                    onChange={(e) => updateField('loyalty_tier_vip_threshold', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Multiplier</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    value={form.loyalty_tier_vip_multiplier ?? ''}
                    onChange={(e) => updateField('loyalty_tier_vip_multiplier', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-green-500" />
            Referral Program
          </CardTitle>
          <CardDescription>Reward guests who bring friends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Referrer Bonus (pts)</Label>
              <Input
                type="number"
                min="0"
                value={form.loyalty_referral_bonus_points ?? ''}
                onChange={(e) => updateField('loyalty_referral_bonus_points', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Points awarded to the guest who referred</p>
            </div>
            <div className="space-y-2">
              <Label>Referred Friend Discount (%)</Label>
              <Input
                type="number"
                min="0"
                max="50"
                value={form.loyalty_referral_discount_percent ?? ''}
                onChange={(e) => updateField('loyalty_referral_discount_percent', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Discount the referred friend gets on first stay</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button (bottom) */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save All Changes
        </Button>
      </div>
    </div>
  );
}
