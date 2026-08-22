import { useState } from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, Home } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════
// Role-specific tab configurations
// ═══════════════════════════════════════════════

interface TabConfig {
  path: string;
  label: string;
  icon: string;
  centerAction?: boolean;
}

const ROLE_TABS: Record<string, TabConfig[]> = {
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
  manager: [
    { path: '/manager', label: 'Home', icon: '🏠', centerAction: false },
    { path: '/manager/bookings', label: 'Bookings', icon: '📅' },
    { path: '/manager', label: 'Reports', icon: '📊', centerAction: true },
    { path: '/manager/staff', label: 'Staff', icon: '👥' },
    { path: '/manager/messages', label: 'Chat', icon: '💬' },
    { path: '/manager/reconciliation', label: 'Money', icon: '💰' },
  ],
  admin: [
    { path: '/admin', label: 'Home', icon: '🏠', centerAction: false },
    { path: '/admin/bookings', label: 'Bookings', icon: '📅' },
    { path: '/admin', label: 'More', icon: '⚙️', centerAction: true },
    { path: '/admin/messages', label: 'Chat', icon: '💬' },
    { path: '/admin/operations', label: 'Ops', icon: '🛡️' },
    { path: '/admin/folios', label: 'Folios', icon: '💰' },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  receptionist: 'Receptionist',
  chef: 'Chef',
  waiter: 'Waiter',
  housekeeper: 'Housekeeper',
  accountant: 'Accountant',
};

const ROLE_ICONS: Record<string, string> = {
  admin: '👑',
  manager: '📊',
  receptionist: '🔑',
  chef: '👨‍🍳',
  waiter: '🍽️',
  housekeeper: '🧹',
  accountant: '💰',
};

const ROLE_BASE_PATHS: Record<string, string> = {
  admin: '/admin',
  manager: '/manager',
  receptionist: '/staff',
  chef: '/staff',
  waiter: '/staff',
  housekeeper: '/staff',
  accountant: '/staff',
};

// ═══════════════════════════════════════════════
// Staff PDA Layout
// ═══════════════════════════════════════════════

export default function StaffPdaLayout() {
  const { user, displayName, displayRole, role, loading, signOut } = useAuth();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Get tabs for current role (fallback to generic)
  const tabs = ROLE_TABS[role || ''] || ROLE_TABS.receptionist;
  const roleName = ROLE_LABELS[role || ''] || 'Staff';
  const roleIcon = ROLE_ICONS[role || ''] || '👤';

  // Get today's date
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative">
      {/* Greeting Header */}
      <div className="bg-navy text-white px-5 pt-3 pb-5 relative overflow-hidden">
        {/* Decorative circle */}
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-brass/15 rounded-full" />
        <div className="absolute right-8 top-8 w-16 h-16 bg-brass/10 rounded-full" />

        <div className="flex items-start justify-between relative z-10">
          <div>
            <h1 className="text-xl font-bold">
              Hi {displayName} 👋
            </h1>
            <p className="text-xs text-white/50 mt-0.5">{dateStr} · {roleName}</p>
            <span className="inline-block mt-2 bg-brass text-navy px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {roleIcon} {roleName}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation Bar */}
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
                  onClick={() => {
                    if (role === 'admin' && tab.icon === '⚙️') {
                      setShowMore(!showMore);
                    } else if (tab.icon === '➕') {
                      if (role === 'receptionist') window.location.href = '/staff/reception';
                      else if (role === 'waiter') window.location.href = '/staff/waiter';
                      else if (role === 'chef') window.location.href = '/staff/kitchen';
                      else window.location.href = '/staff';
                    } else if (tab.icon === '🚫') {
                      window.location.href = '/staff/kitchen';
                    } else if (tab.icon === '🔧') {
                      window.location.href = '/staff/housekeeping';
                    } else if (tab.icon === '📊') {
                      window.location.href = '/manager/reports';
                    } else if (tab.icon === '⚙️') {
                      setShowMore(!showMore);
                    }
                  }}
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

      {/* Admin More Menu Overlay */}
      {showMore && role === 'admin' && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowMore(false)} />
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 p-4 mx-4">
            <p className="text-sm font-bold text-gray-900 mb-3">Admin Tools</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: '🏠', label: 'Dashboard', path: '/admin' },
                { icon: '🛏️', label: 'Rooms', path: '/admin/rooms' },
                { icon: '🍽️', label: 'Menu', path: '/admin/menu' },
                { icon: '📅', label: 'Bookings', path: '/admin/bookings' },
                { icon: '💰', label: 'Folios', path: '/admin/folios' },
                { icon: '👥', label: 'Users', path: '/admin/users' },
                { icon: '📊', label: 'Reports', path: '/admin/reports' },
                { icon: '🛡️', label: 'Operations', path: '/admin/operations' },
                { icon: '🌐', label: 'Content', path: '/admin/content' },
                { icon: '📋', label: 'Audit', path: '/admin/audit' },
                { icon: '💬', label: 'Messages', path: '/admin/messages' },
                { icon: '🔔', label: 'Alerts', path: '/admin/notification-settings' },
              ].map((item) => (
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
// Reusable PDA Components
// ═══════════════════════════════════════════════

// Stat Card — for the horizontal scrolling stats
export function StatCard({ icon, number, label, color }: {
  icon: string;
  number: string | number;
  label: string;
  color: string;
}) {
  return (
    <div className={cn('min-w-[130px] p-4 rounded-2xl text-white relative overflow-hidden shrink-0', color)}>
      <div className="absolute -right-3 -bottom-3 w-12 h-12 bg-white/10 rounded-full" />
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-extrabold leading-none">{number}</div>
      <div className="text-[11px] opacity-80 mt-1">{label}</div>
    </div>
  );
}

// Task Card — for the task list items
export function TaskCard({ icon, iconBg, title, meta, status, statusColor, onClick }: {
  icon: string;
  iconBg: string;
  title: string;
  meta: string;
  status: string;
  statusColor: string;
  onClick?: () => void;
}) {
  return (
    <button
      className="w-full flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform text-left"
      onClick={onClick}
    >
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0', iconBg)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{meta}</p>
      </div>
      <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide shrink-0', statusColor)}>
        {status}
      </span>
    </button>
  );
}

// Section Header
export function SectionHeader({ title, count }: { title: string; count?: string }) {
  return (
    <div className="flex items-center justify-between mt-5 mb-3 px-1">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {count && (
        <span className="bg-gray-100 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-gray-500">
          {count}
        </span>
      )}
    </div>
  );
}

// Stats Row — horizontal scrolling stats container
export function StatsRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
      {children}
    </div>
  );
}
