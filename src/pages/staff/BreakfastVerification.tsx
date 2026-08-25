import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTodayBreakfastItems, useVerifyBreakfastCode, useMarkBreakfastServed, useMarkBreakfastSkipped, useUpdateKitchenStatus, VerifyResult, BreakfastItem } from '@/hooks/useBreakfast';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, CheckCircle2, XCircle, AlertTriangle, Utensils, Clock } from 'lucide-react';

export default function BreakfastVerification() {
  const { data: todayItems, isLoading } = useTodayBreakfastItems();
  const verifyCode = useVerifyBreakfastCode();
  const markServed = useMarkBreakfastServed();
  const markSkipped = useMarkBreakfastSkipped();
  const updateKitchenStatus = useUpdateKitchenStatus();
  const markSkipped = useMarkBreakfastSkipped();
  const { toast } = useToast();

  const [code, setCode] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);

  const handleVerify = async () => {
    if (!code.trim()) return;
    try {
      const res = await verifyCode.mutateAsync(code);
      setResult(res);
    } catch (err: any) {
      toast({ title: 'Verification failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleServe = async () => {
    if (!result?.guest_name || !code) return;
    
    // Confirm with staff: "Serve breakfast for [guest_name] in Room [room_number]?"
    const confirmed = window.confirm(
      `✅ CONFIRM SERVE\n\nGuest: ${result.guest_name}\nRoom: ${result.room_number}\nPax: ${result.pax}\nDate: ${result.meal_date}\n\nServe ${result.pax} breakfast(s)?`
    );
    if (!confirmed) return;

    try {
      await markServed.mutateAsync(code);
      toast({ title: '🍽️ Breakfast served', description: `${result.guest_name} — Room ${result.room_number}` });
      setResult(null);
      setCode('');
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleSkip = async () => {
    if (!code) return;
    try {
      await markSkipped.mutateAsync(code);
      toast({ title: '⏭️ Marked as no-show' });
      setResult(null);
      setCode('');
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    }
  };

  const scheduled = todayItems?.filter(o => o.status === 'scheduled') ?? [];
  const served = todayItems?.filter(o => o.status === 'served') ?? [];
  const skipped = todayItems?.filter(o => o.status === 'skipped') ?? [];
  
  // Group by room
  const byRoom = scheduled.reduce((acc, item) => {
    const key = item.room_number;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, BreakfastItem[]>);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">🍳 Breakfast Verification</h1>
        <p className="text-muted-foreground">Verify guest tracking codes before serving breakfast</p>
      </div>

      {/* Verification Input — The Core Anti-Fraud Tool */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Enter Guest Tracking Code
          </CardTitle>
          <CardDescription>
            Guest shows their KB-XXXX code. Enter it below to verify and confirm their name.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="KB-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              className="text-lg font-mono tracking-widest text-center"
              maxLength={7}
              autoFocus
            />
            <Button onClick={handleVerify} disabled={verifyCode.isPending || !code.trim()}>
              {verifyCode.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Verify
                </>
              )}
            </Button>
          </div>

          {/* Verification Result */}
          {result && (
            <div className={`p-4 rounded-lg border-2 ${
              result.valid 
                ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                : 'border-red-500 bg-red-50 dark:bg-red-950'
            }`}>
              <div className="flex items-start gap-3">
                {result.valid ? (
                  <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold text-lg">{result.message}</p>
                  {result.valid && (
                    <div className="mt-3 space-y-1 text-sm">
                      <p><span className="font-medium">Guest:</span> {result.guest_name}</p>
                      <p><span className="font-medium">Room:</span> {result.room_number}</p>
                      {result.item_name && (
                        <>
                          <p><span className="font-medium">Item:</span> {result.quantity}x {result.item_name}</p>
                          <p><span className="font-medium">Price:</span> {formatCurrency(result.item_price ?? 0)}</p>
                        </>
                      )}
                      {!result.item_name && (
                        <p><span className="font-medium">Pax:</span> {result.pax} breakfast(s)</p>
                      )}
                      <p><span className="font-medium">Date:</span> {result.meal_date}</p>
                    </div>
                  )}
                </div>
              </div>

              {result.valid && (
                <div className="mt-4 flex gap-2">
                  <Button 
                    onClick={handleServe} 
                    className="bg-green-600 hover:bg-green-700"
                    disabled={markServed.isPending}
                  >
                    {markServed.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    ✅ Serve Breakfast
                  </Button>
                  <Button 
                    onClick={handleSkip} 
                    variant="outline"
                    disabled={markSkipped.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    ⏭️ No-Show
                  </Button>
                </div>
              )}

              {!result.valid && result.message?.includes('Invalid code') && (
                <div className="mt-3 p-3 bg-red-100 dark:bg-red-900 rounded text-sm">
                  <p className="font-semibold text-red-800 dark:text-red-200">🚨 Free-Rider Attempt Detected</p>
                  <p className="text-red-700 dark:text-red-300">
                    This guest does NOT have a B&B breakfast. They may have booked Room Only. 
                    Do not serve. Politely inform them that breakfast is only included with Bed & Breakfast packages.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Orders Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            Today's B&B Breakfasts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : !todayItems || todayItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No B&B breakfasts scheduled for today</p>
          ) : (
            <>
              {/* Summary badges */}
              <div className="flex gap-3 mb-4">
                <Badge className="bg-blue-100 text-blue-800">
                  <Clock className="h-3 w-3 mr-1" />
                  Scheduled: {scheduled.length}
                </Badge>
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Served: {served.length}
                </Badge>
                <Badge className="bg-orange-100 text-orange-800">
                  <XCircle className="h-3 w-3 mr-1" />
                  No-Show: {skipped.length}
                </Badge>
              </div>

              {/* Grouped by room */}
              <div className="space-y-4">
                {Object.entries(byRoom).map(([room, items]) => (
                  <div key={room} className="border rounded-lg overflow-hidden">
                    <div className="bg-blue-50 dark:bg-blue-950 px-4 py-2 border-b">
                      <p className="font-semibold">🛏️ Room {room} — {items[0].guest_name}</p>
                    </div>
                    <div className="divide-y">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-2">
                          <div className="flex items-center gap-3">
                            <div className="font-mono text-xs font-bold bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">
                              {item.verification_code}
                            </div>
                            <div>
                              <p className="font-medium">{item.quantity}x {item.item_name}</p>
                              <p className="text-xs text-muted-foreground">{formatCurrency(item.item_price)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {item.kitchen_status === 'pending' && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateKitchenStatus.mutate({ itemId: item.id, status: 'preparing' })}>
                                👨‍🍳 Start
                              </Button>
                            )}
                            {item.kitchen_status === 'preparing' && (
                              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => updateKitchenStatus.mutate({ itemId: item.id, status: 'ready' })}>
                                ✅ Ready
                              </Button>
                            )}
                            {item.kitchen_status === 'ready' && (
                              <Badge className="bg-green-100 text-green-800 text-xs">Ready</Badge>
                            )}
                            {(item.kitchen_status === 'served' || item.kitchen_status === 'skipped') && (
                              <Badge variant="secondary" className="text-xs capitalize">{item.kitchen_status}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Served items */}
                {served.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-green-600">✅ Served ({served.length})</p>
                    {served.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded opacity-70">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-green-100 px-1 rounded">{item.verification_code}</span>
                          <span className="text-sm">{item.quantity}x {item.item_name} — Room {item.room_number}</span>
                        </div>
                        <span className="text-xs text-green-600">
                          {item.verified_at ? new Date(item.verified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Skipped items */}
                {skipped.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-orange-600">⏭️ No-Show ({skipped.length})</p>
                    {skipped.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-950 rounded opacity-70">
                        <span className="text-sm">{item.quantity}x {item.item_name} — Room {item.room_number}</span>
                        <Badge className="bg-orange-100 text-orange-800 text-xs">No-Show</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
