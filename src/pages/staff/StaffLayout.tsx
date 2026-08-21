import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader2, LayoutDashboard, CalendarCheck, ClipboardList, Receipt, LogOut, Home, Sparkles, ClipboardCheck, LogIn, UtensilsCrossed, ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/staff', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/staff/reception', label: 'Reception', icon: LogIn },
  { path: '/staff/bookings', label: 'Bookings', icon: CalendarCheck },
  { path: '/staff/waiter', label: 'Waiter', icon: UtensilsCrossed },
  { path: '/staff/kitchen', label: 'Kitchen', icon: ChefHat },
  { path: '/staff/housekeeping', label: 'My Rooms', icon: Sparkles },
  { path: '/staff/inspection', label: 'Inspection', icon: ClipboardCheck },
  { path: '/staff/requests', label: 'Guest Requests', icon: ClipboardList },
  { path: '/staff/receipts', label: 'Receipts', icon: Receipt },
];

export default function StaffLayout() {
  const { user, isStaff, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="font-display text-3xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have staff permissions. Please contact an administrator to request access.
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
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-navy text-primary-foreground flex flex-col">
        <div className="p-6 border-b border-primary-foreground/10">
          <Link to="/" className="font-display text-2xl font-bold">
            Keyman<span className="text-brass"> Hotel</span>
          </Link>
          <p className="text-xs text-primary-foreground/50 mt-1">Staff Panel</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact 
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            
            return (
              <Link key={item.path} to={item.path}>
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

        <div className="p-4 border-t border-primary-foreground/10">
          <div className="mb-4 px-3">
            <p className="text-xs text-primary-foreground/50">Signed in as</p>
            <p className="text-sm truncate">{user.email}</p>
          </div>
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

      {/* Main content */}
      <main className="flex-1 bg-muted/30 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
