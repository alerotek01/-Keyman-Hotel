import { useState, useEffect } from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell';
import { cn } from '@/lib/utils';
import {
  Loader2, LogOut, Home, LayoutDashboard, BedDouble, CalendarCheck, UtensilsCrossed,
  ChefHat, Sparkles, ClipboardCheck, ClipboardList, Receipt, CreditCard, Clock,
  MessageSquare, Bell, BarChart3, DollarSign, Users, Activity, Settings, Package,
  Shield, Wrench, ScrollText, Globe, UserCog, Building2
} from 'lucide-react';

const DESKTOP_BREAKPOINT = 768;

// ═══════════════════════════════════════════════
// NAV CONFIGS — Desktop sidebar items per role
// ═══════════════════════════════════════════════

interface NavItem {
  path: string;
  label: string;
  icon: any;
  exact?: boolean;
}

const NAV_CONFIGS: Record<string, NavItem[]> = {
  manager: [
    { path: '/manager', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { path: '/manager/bookings', label: 'Bookings', icon: CalendarCheck },
    { path: '/manager/reconciliation', label: 'Reconciliation', icon: DollarSign },
    { path: '/manager/reports', label: 'Reports', icon: BarChart3 },
    { path: '/manager/staff', label: 'Staff', icon: Users },
    { path: '/manager/shift', label: 'Shift Mgmt', icon: Clock },
    { path: '/manager/inventory', label: 'Inventory', icon: Package },
    { path: '/manager/operations', label: 'Operations', icon: Activity },
    { path: '/manager/messages', label: 'Messages', icon: MessageSquare },
    { path: '/manager/notification-settings', label: 'Notifications', icon: Bell },
  ],
  admin: [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { path: '/admin/rooms', label: 'Rooms', icon: BedDouble },
    { path: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
    { path: '/admin/content', label: 'Site Content', icon: Globe },
    { path: '/admin/bookings', label: 'Bookings', icon: CalendarCheck },
    { path: '/admin/folios', label: 'Folios', icon: Receipt },
    { path: '/admin/users', label: 'Users', icon: UserCog },
    { path: '/admin/reports', label: 'Reports', icon: ScrollText },
    { path: '/admin/audit', label: 'Audit Logs', icon: Shield },
    { path: '/admin/operations', label: 'Operations', icon: Activity },
    { path: '/admin/conference', label: 'Conference', icon: Building2 },
    { path: '/admin/booking-settings', label: 'Booking Rules', icon: Settings },
    { path: '/admin/payments-verify', label: 'Verify Payments', icon: CreditCard },
    { path: '/admin/messages', label: 'Messages', icon: MessageSquare },
    { path: '/admin/notification-settings', label: 'Notifications', icon: Bell },
  ],
  staff: [
    { path: '/staff', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { path: '/staff/reception', label: 'Reception', icon: Wrench },
    { path: '/staff/bookings', label: 'Bookings', icon: CalendarCheck },
    { path: '/staff/waiter', label: 'Waiter', icon: UtensilsCrossed },
    { path: '/staff/kitchen', label: 'Kitchen', icon: ChefHat },
    { path: '/staff/housekeeping', label: 'My Rooms', icon: Sparkles },
    { path: '/staff/inspection', label: 'Inspection', icon: ClipboardCheck },
    { path: '/staff/payments', label: 'Payments', icon: CreditCard },
    { path: '/staff/shift', label: 'My Shift', icon: Clock },
    { path: '/staff/requests', label: 'Guest Requests', icon: ClipboardList },
    { path: '/staff/receipts', label: 'Receipts', icon: Receipt },
    { path: '/staff/messages', label: 'Messages', icon: MessageSquare },
    { path: '/staff/notification-settings', label: 'Notifications', icon: Bell },
  ],
};

// ═══════════════════════════════════════════════
// MOBILE PDA TAB CONFIGS per role
// ═══════════════════════════════════════════════

interface TabConfig {
  path: string;
  label: string;
  icon: string;
  centerAction?: boolean;
}

const ROLE_TABS: Record<string, TabConfig[]> = {
  manager: [
    { path: '/manager', label: 'Home', icon: '🏠', centerAction: false },
    { path: '/manager/bookings', label: 'Bookings', icon: '📅' },
    { path: '/manager', label: 'More', icon: '📊', centerAction: true },
    { path: '/manager/staff', label: 'Staff', icon: '👥' },
    { path: '/manager/messages', label: 'Chat', icon: '💬' },
    { path: '/manager/reconciliation', label: 'Money', icon: '💰' },
  ],
  receptionist: [
    { path: '/staff', label: 'Home', icon: '🏠', centerAction: false },
    { path: '/staff/reception', label: 'Check-In', icon: '📋' },
    { path: '/staff', label: 'Walk-in', icon: '➕', centerAction: true },
    { path: '/staff/bookings', label: 'Arrivals', icon: '📅' },
    { path: '/staff/messages', label: 'Chat', icon: '💬' },
    { path: '/staff/payments', label: 'Pay', icon: '💳' },
  ],
  waiter: [
    { path: '/staff', label: 'Orders', icon: '📋', centerAction: false },
    { path: '/staff/waiter', label: 'Take', icon: '🍽️' },
    { path: '/staff', label: 'New', icon: '➕', centerAction: true },
    { path: '/staff', label: 'Tables', icon: '🪑' },
    { path: '/staff/messages', label: 'Chat', icon: '💬' },
    { path: '/staff/shift', label: 'Shift', icon: '⏰' },
  ],
  chef: [
    { path: '/staff/kitchen', label: 'Queue', icon: '📋', centerAction: false },
    { path: '/staff/kitchen', label: 'Status', icon: '👨‍🍳' },
    { path: '/staff', label: 'Sold Out', icon: '🚫', centerAction: true },
    { path: '/staff', label: 'Menu', icon: '📖' },
    { path: '/staff/messages', label: 'Chat', icon: '💬' },
    { path: '/staff/shift', label: 'Shift', icon: '⏰' },
  ],
  housekeeper: [
    { path: '/staff/housekeeping', label: 'Rooms', icon: '🏠', centerAction: false },
    { path: '/staff/inspection', label: 'Inspect', icon: '🔍' },
    { path: '/staff', label: 'Report', icon: '🔧', centerAction: true },
    { path: '/staff/requests', label: 'Requests', icon: '📋' },
    { path: '/staff/messages', label: 'Chat', icon: '💬' },
    { path: '/staff/shift', label: 'Shift', icon: '⏰' },
  ],
};

// Manager "More" overlay items
const MANAGER_MORE_ITEMS = [
  { icon: '🏠', label: 'Dashboard', path: '/manager' },
  { icon: '📅', label: 'Bookings', path: '/manager/bookings' },
  { icon: '💰', label: 'Reconciliation', path: '/manager/reconciliation' },
  { icon: '📊', label: 'Reports', path: '/manager/reports' },
  { icon: '👥', label: 'Staff', path: '/manager/staff' },
  { icon: '⏰', label: 'Shift Mgmt', path: '/manager/shift' },
  { icon: '📦', label: 'Inventory', path: '/manager/inventory' },
  { icon: '🛡️', label: 'Operations', path: '/manager/operations' },
  { icon: '💬', label: 'Messages', path: '/manager/messages' },
  { icon: '🔔', label: 'Alerts', path: '/manager/notification-settings' },
];

// ═══════════════════════════════════════════════
// DESKTOP SIDEBAR LAYOUT
// ═══════════════════════════════════════════════

function DesktopSidebar({ basePath, navItems, displayName, displayRole, onSignOut }: {
  basePath: string;
  navItems: NavItem[];
  displayName: string;
  displayRole: string;
  onSignOut: () => void;
}) {
  const location = useLocation();
  const panelLabel = basePath === '/manager' ? 'Manager Panel' : basePath === '/admin' ? 'Admin Panel' : 'Staff Panel';

  return (
    <aside className="w-64 bg-navy text-primary-foreground flex flex-col shrink-0 h-screen sticky top-0">
      <div className="p-6 border-b border-primary-foreground/10">
        <Link to="/" className="font-display text-2xl font-bold">
          Keyman<span className="text-brass"> Hotel</span>
        </Link>
        <p className="text-xs text-primary-foreground/50 mt-1">{panelLabel}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
          <p className="text-sm font-semibold text-primary-foreground truncate">{displayName}</p>
          <p className="text-[10px] text-brass uppercase tracking-wide">{displayRole}</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
          onClick={onSignOut}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════
// MOBILE PDA LAYOUT
// ═══════════════════════════════════════════════

function MobilePdaLayout({ role, tabs, displayName, displayRole, onSignOut, showMore, setShowMore, moreItems }: {
  role: string;
  tabs: TabConfig[];
  displayName: string;
  displayRole: string;
  onSignOut: () => void;
  showMore: boolean;
  setShowMore: (v: boolean) => void;
  moreItems?: { icon: string; label: string; path: string }[];
}) {
  const location = useLocation();
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const ROLE_LABELS: Record<string, string> = { admin: 'Administrator', manager: 'Manager', receptionist: 'Receptionist', chef: 'Chef', waiter: 'Waiter', housekeeper: 'Housekeeper', accountant: 'Accountant' };
  const ROLE_ICONS: Record<string, string> = { admin: '👑', manager: '📊', receptionist: '🔑', chef: '👨‍🍳', waiter: '🍽️', housekeeper: '🧹', accountant: '💰' };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative">
      {/* Greeting Header */}
      <div className="bg-navy text-white px-5 pt-3 pb-5 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-brass/15 rounded-full" />
        <div className="absolute right-8 top-8 w-16 h-16 bg-brass/10 rounded-full" />
        <div className="flex items-start justify-between relative z-10">
          <div>
            <h1 className="text-xl font-bold">Hi {displayName} 👋</h1>
            <p className="text-xs text-white/50 mt-0.5">{dateStr} · {ROLE_LABELS[role] || 'Staff'}</p>
            <span className="inline-block mt-2 bg-brass text-navy px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {ROLE_ICONS[role] || '👤'} {ROLE_LABELS[role] || 'Staff'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Link to="/" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-colors" title="Visit Website">
              <Globe className="h-4 w-4" />
            </Link>
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-2 pt-2 pb-6 z-50">
        <div className="flex items-center justify-around">
          {tabs.map((tab, i) => {
            const isActive = tab.centerAction
              ? false
              : location.pathname === tab.path
              || (tab.path !== '/staff' && tab.path !== '/manager' && location.pathname.startsWith(tab.path));

            if (tab.centerAction) {
              return (
                <button
                  key={i}
                  className="w-14 h-14 bg-brass rounded-full flex items-center justify-center text-white text-2xl shadow-lg shadow-brass/30 -mt-6 border-4 border-white"
                  onClick={() => setShowMore(!showMore)}
                >
                  {tab.icon === '➕' ? '+' : tab.icon}
                </button>
              );
            }

            return (
              <Link
                key={i}
                to={tab.path}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1 transition-colors',
                  isActive ? 'text-brass' : 'text-gray-400'
                )}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* More Menu Overlay */}
      {showMore && moreItems && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowMore(false)} />
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 p-4 mx-4">
            <p className="text-sm font-bold text-gray-900 mb-3">Quick Access</p>
            <div className="grid grid-cols-4 gap-3">
              {moreItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={() => setShowMore(false)}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-[10px] font-medium text-gray-600">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN RESPONSIVE LAYOUT COMPONENT
// ═══════════════════════════════════════════════

interface ResponsiveLayoutProps {
  basePath: string; // '/manager', '/admin', '/staff'
  allowedRoles?: string[]; // roles allowed to access this layout
}

export default function ResponsiveLayout({ basePath, allowedRoles }: ResponsiveLayoutProps) {
  const { user, displayName, displayRole, role, loading, signOut } = useAuth();
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= DESKTOP_BREAKPOINT;
  });
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  // Check role permissions
  if (allowedRoles && !allowedRoles.includes(role || '')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="font-display text-3xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">You don't have the required permissions.</p>
          <Link to="/"><Button variant="outline"><Home className="mr-2 h-4 w-4" /> Go Home</Button></Link>
        </div>
      </div>
    );
  }

  // Determine nav config based on basePath
  const navConfig = basePath === '/manager' ? NAV_CONFIGS.manager
    : basePath === '/admin' ? NAV_CONFIGS.admin
    : NAV_CONFIGS.staff;

  // Determine mobile tabs
  const mobileTabs = ROLE_TABS[role || ''] || ROLE_TABS.receptionist;

  // Desktop: full sidebar layout
  if (isDesktop) {
    return (
      <div className="min-h-screen flex">
        <DesktopSidebar
          basePath={basePath}
          navItems={navConfig}
          displayName={displayName || ''}
          displayRole={displayRole || ''}
          onSignOut={signOut}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 bg-white border-b border-border flex items-center justify-end px-4 shrink-0">
            <NotificationBell />
          </header>
          <main className="flex-1 bg-muted/30 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  // Mobile: PDA layout with bottom nav
  return (
    <MobilePdaLayout
      role={role || ''}
      tabs={mobileTabs}
      displayName={displayName || ''}
      displayRole={displayRole || ''}
      onSignOut={signOut}
      showMore={showMore}
      setShowMore={setShowMore}
      moreItems={basePath === '/manager' ? MANAGER_MORE_ITEMS : undefined}
    />
  );
}
