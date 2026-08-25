import { useNotificationPreferences, useUpdateNotificationPreferences, NOTIFICATION_EVENTS } from '@/hooks/useNotificationPreferences';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Bell, BellOff, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

function EventIcon({ icon }: { icon: string }) {
  const iconMap: Record<string, string> = {
    calendar: '📅',
    'log-in': '🔑',
    'log-out': '🚪',
    sparkles: '✨',
    utensils: '🍽️',
    'credit-card': '💳',
    clipboard: '📋',
    bell: '🔔',
  };
  return <span className="text-lg">{iconMap[icon] || '📌'}</span>;
}

export default function NotificationSettings() {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const [localPrefs, setLocalPrefs] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local state from server
  useEffect(() => {
    if (prefs) {
      const map: Record<string, boolean> = {};
      NOTIFICATION_EVENTS.forEach((ev) => {
        map[ev.key] = (prefs as Record<string, unknown>)[ev.key] !== false;
      });
      setLocalPrefs(map);
    }
  }, [prefs]);

  const toggle = (key: string) => {
    setLocalPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      setHasChanges(true);
      return next;
    });
  };

  const toggleAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    NOTIFICATION_EVENTS.forEach((ev) => { next[ev.key] = value; });
    setLocalPrefs(next);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updatePrefs.mutateAsync(localPrefs as any);
      setHasChanges(false);
      toast.success('Notification preferences saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save preferences');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const allOn = NOTIFICATION_EVENTS.every((ev) => localPrefs[ev.key]);
  const allOff = NOTIFICATION_EVENTS.every((ev) => !localPrefs[ev.key]);
  const enabledCount = NOTIFICATION_EVENTS.filter((ev) => localPrefs[ev.key]).length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold">Notification Settings</h1>
        <p className="text-muted-foreground mt-1">
          Choose which events you want to be notified about
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center',
                allOn ? 'bg-green-100 text-green-600' : allOff ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
              )}>
                {allOn ? <Bell className="h-5 w-5" /> : allOff ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-semibold">
                  {enabledCount} of {NOTIFICATION_EVENTS.length} events enabled
                </p>
                <p className="text-xs text-muted-foreground">
                  {allOn ? 'You will receive all notifications' : allOff ? 'All notifications are muted' : 'Custom notification mix'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)} disabled={allOn}>
                Enable All
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(false)} disabled={allOff}>
                Disable All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Events</CardTitle>
          <CardDescription>Toggle each event type on or off</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {NOTIFICATION_EVENTS.map((ev) => {
              const isEnabled = localPrefs[ev.key] !== false;
              return (
                <button
                  key={ev.key}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left',
                    isEnabled
                      ? 'bg-white hover:bg-muted/50 border-border'
                      : 'bg-muted/30 hover:bg-muted/50 border-border/50 opacity-60'
                  )}
                  onClick={() => toggle(ev.key)}
                >
                  <EventIcon icon={ev.icon} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{ev.label}</p>
                    <p className="text-xs text-muted-foreground">{ev.description}</p>
                  </div>
                  <div className={cn(
                    'relative w-11 h-6 rounded-full transition-colors shrink-0',
                    isEnabled ? 'bg-brass' : 'bg-gray-300'
                  )}>
                    <div className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      isEnabled ? 'translate-x-5.5 left-[1px]' : 'translate-x-0 left-[2px]'
                    )} />
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button variant="brass" onClick={handleSave} disabled={updatePrefs.isPending} className="shadow-lg">
            {updatePrefs.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Preferences
          </Button>
        </div>
      )}
    </div>
  );
}
