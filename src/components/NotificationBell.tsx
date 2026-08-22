import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotifications, useMarkAsRead, useMarkAllRead, type Notification } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, CheckCheck, CalendarCheck, LogIn, LogOut, Sparkles, UtensilsCrossed, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

function getNotificationIcon(type?: string) {
  switch (type) {
    case 'booking':
      return <CalendarCheck className="h-4 w-4 text-blue-500" />;
    case 'check_in':
      return <LogIn className="h-4 w-4 text-green-500" />;
    case 'check_out':
      return <LogOut className="h-4 w-4 text-orange-500" />;
    case 'housekeeping':
      return <Sparkles className="h-4 w-4 text-purple-500" />;
    case 'restaurant':
      return <UtensilsCrossed className="h-4 w-4 text-red-500" />;
    default:
      return <Info className="h-4 w-4 text-gray-500" />;
  }
}

function getNotificationPath(notification: Notification): string | null {
  if (!notification.related_table) return null;
  switch (notification.related_table) {
    case 'reservations':
      return '/admin/bookings';
    case 'housekeeping_tasks':
      return '/staff/housekeeping';
    case 'restaurant_orders':
      return '/staff/kitchen';
    case 'guest_folios':
      return '/admin/folios';
    default:
      return null;
  }
}

export default function NotificationBell() {
  const { data: notifications, unreadCount } = useNotifications();
  const { user } = useAuth();
  const markAsRead = useMarkAsRead();
  const markAllRead = useMarkAllRead();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    // Navigate to relevant page
    const path = getNotificationPath(notification);
    if (path) {
      navigate(path);
      setOpen(false);
    }
  };

  const handleMarkAllRead = () => {
    if (user?.id) {
      markAllRead.mutate(user.id);
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="sm"
        className="relative h-9 w-9 p-0"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] font-bold bg-red-500 text-white border-2 border-white rounded-full flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Dropdown Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-border z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <h3 className="font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleMarkAllRead}
                    disabled={markAllRead.isPending}
                  >
                    <CheckCheck className="h-3 w-3 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-96 overflow-y-auto">
              {!notifications || notifications.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 border-b border-border/50 cursor-pointer transition-colors hover:bg-muted/50',
                      !notification.read && 'bg-blue-50/50'
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="mt-0.5 shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm leading-tight',
                        !notification.read ? 'font-semibold' : 'font-medium'
                      )}>
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="shrink-0 mt-1">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications && notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-border bg-muted/20 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    markAllRead.mutate(user?.id || '');
                    setOpen(false);
                  }}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
