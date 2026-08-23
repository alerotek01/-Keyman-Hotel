import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Loader2, LayoutDashboard, BedDouble, CalendarCheck, ScrollText, 
  LogOut, Home, UtensilsCrossed, Globe, Receipt, Users, Menu, X,
  ChevronLeft, Activity, MessageSquare, Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import NotificationBell from '@/components/NotificationBell';

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/rooms', label: 'Rooms', icon: BedDouble },
  { path: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
  { path: '/admin/content', label: 'Site Content', icon: Globe },
  { path: '/admin/bookings', label: 'Bookings', icon: CalendarCheck },
  { path: '/admin/folios', label: 'Folios', icon: Receipt },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/reports', label: 'Reports', icon: ScrollText },
  { path: '/admin/audit', label: 'Audit Logs', icon: ScrollText },
  { path: '/admin/operations', label: 'Operations', icon: Activity },
  { path: '/admin/booking-settings', label: 'Booking Rules', icon: Bell },
  { path: '/admin/payments-verify', label: 'Verify Payments', icon: Receipt },
  { path: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { path: '/admin/notification-settings', label: 'Notifications', icon: Bell },
];

export default function AdminLayout() {
  const { user, displayName, displayRole, displayEmail, isAdmin, loading, signOut, isImpersonating, stopImpersonating } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
        <p className="text-sm text-muted-foreground">Loading admin panel...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="font-display text-3xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have admin permissions. Please contact an administrator to request access.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/">
              <Button variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </Link>
            <Button variant="brass" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar — always visible with prominent logout */}
      <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-muted"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm font-medium hidden sm:inline">Back to Site</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          {isImpersonating && (
            <Button variant="outline" size="sm" onClick={stopImpersonating} className="text-amber-600 border-amber-300 hover:bg-amber-50">
              Stop Impersonating
            </Button>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold leading-tight">{displayName}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{displayRole}</p>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={signOut}
            className="gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className={cn(
          "w-64 bg-navy text-primary-foreground flex flex-col shrink-0 transition-all duration-200",
          "lg:relative absolute inset-y-0 left-0 z-10",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden"
        )}>
          <div className="p-6 border-b border-primary-foreground/10">
            <Link to="/" className="font-display text-2xl font-bold">
              Keyman<span className="text-brass"> Hotel</span>
            </Link>
            <p className="text-xs text-primary-foreground/50 mt-1">Admin Panel</p>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = item.exact 
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              
              return (
                <Link key={item.path} to={item.path} onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10",
                      isActive && "bg-brass/10 text-brass hover:text-brass hover:bg-brass/10"
                    )}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Sidebar footer — secondary logout */}
          <div className="p-4 border-t border-primary-foreground/10">
            <Button
              variant="ghost"
              className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={signOut}
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-[5]"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 bg-muted/30 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
