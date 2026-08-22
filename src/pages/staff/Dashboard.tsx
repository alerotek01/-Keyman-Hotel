import { useBookings } from '@/hooks/useBookings';
import { useGuestRequests } from '@/hooks/useGuestRequests';
import { useAllRooms } from '@/hooks/useRooms';
import { useAuth } from '@/hooks/useAuth';
import { StatCard, TaskCard, SectionHeader, StatsRow } from '@/components/StaffPdaLayout';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'bg-amber-50', color: 'bg-amber-100 text-amber-700' },
  confirmed: { bg: 'bg-blue-50', color: 'bg-blue-100 text-blue-700' },
  checked_in: { bg: 'bg-emerald-50', color: 'bg-emerald-100 text-emerald-700' },
  checked_out: { bg: 'bg-gray-50', color: 'bg-gray-100 text-gray-600' },
  in_progress: { bg: 'bg-blue-50', color: 'bg-blue-100 text-blue-700' },
  completed: { bg: 'bg-emerald-50', color: 'bg-emerald-100 text-emerald-700' },
  urgent: { bg: 'bg-red-50', color: 'bg-red-100 text-red-700' },
};

export default function StaffDashboard() {
  const { displayName, role } = useAuth();
  const { data: bookings, isLoading: bookingsLoading } = useBookings();
  const { data: guestRequests, isLoading: requestsLoading } = useGuestRequests();
  const { data: rooms, isLoading: roomsLoading } = useAllRooms();

  const isLoading = bookingsLoading || requestsLoading || roomsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayCheckIns = bookings?.filter(b => b.check_in === today && b.status !== 'cancelled') || [];
  const todayCheckOuts = bookings?.filter(b => b.check_out === today && b.status !== 'cancelled') || [];
  const pendingBookings = bookings?.filter(b => b.status === 'pending') || [];
  const pendingRequests = guestRequests?.filter(r => r.status === 'pending') || [];
  const inProgressRequests = guestRequests?.filter(r => r.status === 'in_progress') || [];
  const availableRooms = rooms?.filter(r => r.status === 'available') || [];
  const occupiedRooms = rooms?.filter(r => r.status === 'occupied') || [];

  // Role-specific dashboard
  if (role === 'receptionist') {
    return <ReceptionistDashboard
      todayCheckIns={todayCheckIns}
      todayCheckOuts={todayCheckOuts}
      pendingBookings={pendingBookings}
      pendingRequests={pendingRequests}
      availableRooms={availableRooms}
    />;
  }

  if (role === 'waiter') {
    return <WaiterDashboard />;
  }

  if (role === 'chef') {
    return <ChefDashboard />;
  }

  if (role === 'housekeeper') {
    return <HousekeeperDashboard
      pendingRequests={pendingRequests}
      inProgressRequests={inProgressRequests}
      rooms={rooms || []}
    />;
  }

  // Default / manager
  return <DefaultDashboard
    todayCheckIns={todayCheckIns}
    todayCheckOuts={todayCheckOuts}
    pendingBookings={pendingBookings}
    pendingRequests={pendingRequests}
    availableRooms={availableRooms}
  />;
}

// ═══════════════════════════════════════════════
// RECEPTIONIST DASHBOARD
// ═══════════════════════════════════════════════
function ReceptionistDashboard({ todayCheckIns, todayCheckOuts, pendingBookings, pendingRequests, availableRooms }: any) {
  return (
    <div className="px-5 py-4 space-y-1">
      {/* Stats */}
      <StatsRow>
        <StatCard icon="🔑" number={todayCheckIns.length} label="Check-Ins Today" color="bg-gradient-to-br from-emerald-400 to-emerald-600" />
        <StatCard icon="🚪" number={todayCheckOuts.length} label="Check-Outs" color="bg-gradient-to-br from-orange-400 to-pink-500" />
        <StatCard icon="🛏️" number={availableRooms.length} label="Rooms Available" color="bg-gradient-to-br from-blue-400 to-purple-500" />
        <StatCard icon="📋" number={pendingBookings.length} label="Pending Bookings" color="bg-gradient-to-br from-brass to-yellow-500" />
      </StatsRow>

      {/* Today's Arrivals */}
      <SectionHeader title="Today's Arrivals" count={`${todayCheckIns.length} guests`} />
      <div className="space-y-2">
        {todayCheckIns.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No arrivals today</p>
        ) : (
          todayCheckIns.slice(0, 5).map((b: any) => (
            <TaskCard
              key={b.id}
              icon="🧑"
              iconBg="bg-emerald-50"
              title={b.guests?.name || 'Guest'}
              meta={`Room ${b.rooms?.room_number} · ${b.num_adults + b.num_children} guest(s)`}
              status="Pending"
              statusColor="bg-amber-100 text-amber-700"
              onClick={() => window.location.href = '/staff/reception'}
            />
          ))
        )}
      </div>

      {/* Pending Bookings */}
      {pendingBookings.length > 0 && (
        <>
          <SectionHeader title="Pending Bookings" count={`${pendingBookings.length} awaiting`} />
          <div className="space-y-2">
            {pendingBookings.slice(0, 3).map((b: any) => (
              <TaskCard
                key={b.id}
                icon="📅"
                iconBg="bg-blue-50"
                title={b.guests?.name || 'Guest'}
                meta={`Room ${b.rooms?.room_number} · ${format(new Date(b.check_in), 'MMM d')} - ${format(new Date(b.check_out), 'MMM d')}`}
                status="Confirm"
                statusColor="bg-blue-100 text-blue-700"
                onClick={() => window.location.href = '/staff/bookings'}
              />
            ))}
          </div>
        </>
      )}

      {/* Guest Requests */}
      {pendingRequests.length > 0 && (
        <>
          <SectionHeader title="Guest Requests" count={`${pendingRequests.length} open`} />
          <div className="space-y-2">
            {pendingRequests.slice(0, 3).map((r: any) => (
              <TaskCard
                key={r.id}
                icon="🛎️"
                iconBg="bg-red-50"
                title={r.request_type.replace('_', ' ')}
                meta={`${r.bookings?.guests?.name} · Room ${r.bookings?.rooms?.room_number}`}
                status="Urgent"
                statusColor="bg-red-100 text-red-700"
                onClick={() => window.location.href = '/staff/requests'}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// WAITER DASHBOARD
// ═══════════════════════════════════════════════
function WaiterDashboard() {
  // Placeholder — will use restaurant orders data
  return (
    <div className="px-5 py-4 space-y-1">
      <StatsRow>
        <StatCard icon="🍽️" number="4" label="Active Orders" color="bg-gradient-to-br from-orange-400 to-pink-500" />
        <StatCard icon="✅" number="12" label="Served Today" color="bg-gradient-to-br from-emerald-400 to-emerald-600" />
        <StatCard icon="🪑" number="8" label="Tables Active" color="bg-gradient-to-br from-blue-400 to-purple-500" />
      </StatsRow>

      <SectionHeader title="Ready to Serve" count="2 ready" />
      <div className="space-y-2">
        <TaskCard icon="🔥" iconBg="bg-emerald-50" title="Table 3 — Chicken & Chips" meta="2 items · Ready since 12:15" status="Ready" statusColor="bg-emerald-100 text-emerald-700" />
        <TaskCard icon="🍲" iconBg="bg-emerald-50" title="Table 7 — Beef Stew + Rice" meta="3 items · Ready since 12:18" status="Ready" statusColor="bg-emerald-100 text-emerald-700" />
      </div>

      <SectionHeader title="Preparing" count="2 cooking" />
      <div className="space-y-2">
        <TaskCard icon="⏳" iconBg="bg-amber-50" title="Table 5 — Fish & Vegetables" meta="1 item · ~5 min remaining" status="Cooking" statusColor="bg-amber-100 text-amber-700" />
        <TaskCard icon="⏳" iconBg="bg-amber-50" title="Table 1 — Full Breakfast" meta="4 items · ~8 min remaining" status="Cooking" statusColor="bg-amber-100 text-amber-700" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// CHEF DASHBOARD
// ═══════════════════════════════════════════════
function ChefDashboard() {
  return (
    <div className="px-5 py-4 space-y-1">
      <StatsRow>
        <StatCard icon="🔥" number="5" label="In Queue" color="bg-gradient-to-br from-orange-400 to-pink-500" />
        <StatCard icon="✅" number="18" label="Completed" color="bg-gradient-to-br from-emerald-400 to-emerald-600" />
        <StatCard icon="🚫" number="2" label="Sold Out" color="bg-gradient-to-br from-red-400 to-red-600" />
      </StatsRow>

      <SectionHeader title="Order Queue" count="5 pending" />
      <div className="space-y-2">
        <TaskCard icon="🔴" iconBg="bg-red-50" title="Order #47 — Table 3" meta="Chicken & Chips · 12:10 PM" status="New" statusColor="bg-red-100 text-red-700" />
        <TaskCard icon="🟡" iconBg="bg-amber-50" title="Order #46 — Table 7" meta="Beef Stew + Rice · 12:08 PM" status="Preparing" statusColor="bg-amber-100 text-amber-700" />
        <TaskCard icon="🟡" iconBg="bg-amber-50" title="Order #45 — Table 5" meta="Fish & Vegetables · 12:05 PM" status="Preparing" statusColor="bg-amber-100 text-amber-700" />
        <TaskCard icon="🟢" iconBg="bg-emerald-50" title="Order #44 — Table 1" meta="Full Breakfast · 12:02 PM" status="Done" statusColor="bg-emerald-100 text-emerald-700" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// HOUSEKEEPER DASHBOARD
// ═══════════════════════════════════════════════
function HousekeeperDashboard({ pendingRequests, inProgressRequests, rooms }: any) {
  const dirtyRooms = rooms?.filter((r: any) => r.status === 'dirty') || [];
  const cleanRooms = rooms?.filter((r: any) => r.status === 'available') || [];

  return (
    <div className="px-5 py-4 space-y-1">
      <StatsRow>
        <StatCard icon="🧹" number={dirtyRooms.length} label="To Clean" color="bg-gradient-to-br from-orange-400 to-pink-500" />
        <StatCard icon="✅" number={cleanRooms.length} label="Clean" color="bg-gradient-to-br from-emerald-400 to-emerald-600" />
        <StatCard icon="📋" number={pendingRequests.length + inProgressRequests.length} label="Guest Requests" color="bg-gradient-to-br from-blue-400 to-purple-500" />
      </StatsRow>

      <SectionHeader title="Rooms to Clean" count={`${dirtyRooms.length} remaining`} />
      <div className="space-y-2">
        {dirtyRooms.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">All rooms clean! 🎉</p>
        ) : (
          dirtyRooms.slice(0, 5).map((r: any) => (
            <TaskCard
              key={r.id}
              icon="🛏️"
              iconBg="bg-red-50"
              title={`Room ${r.room_number}`}
              meta={`${r.room_types?.name || 'Room'} · Needs cleaning`}
              status="Dirty"
              statusColor="bg-red-100 text-red-700"
              onClick={() => window.location.href = '/staff/housekeeping'}
            />
          ))
        )}
      </div>

      {/* Guest Requests */}
      {[...pendingRequests, ...inProgressRequests].length > 0 && (
        <>
          <SectionHeader title="Guest Requests" count={`${pendingRequests.length} new`} />
          <div className="space-y-2">
            {[...pendingRequests, ...inProgressRequests].slice(0, 3).map((r: any) => (
              <TaskCard
                key={r.id}
                icon="🛎️"
                iconBg="bg-blue-50"
                title={r.request_type.replace('_', ' ')}
                meta={`${r.bookings?.guests?.name} · Room ${r.bookings?.rooms?.room_number}`}
                status={r.status === 'pending' ? 'New' : 'In Progress'}
                statusColor={r.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}
                onClick={() => window.location.href = '/staff/requests'}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// DEFAULT DASHBOARD (Manager / Other)
// ═══════════════════════════════════════════════
function DefaultDashboard({ todayCheckIns, todayCheckOuts, pendingBookings, pendingRequests, availableRooms }: any) {
  return (
    <div className="px-5 py-4 space-y-1">
      <StatsRow>
        <StatCard icon="🔑" number={todayCheckIns.length} label="Check-Ins" color="bg-gradient-to-br from-emerald-400 to-emerald-600" />
        <StatCard icon="🚪" number={todayCheckOuts.length} label="Check-Outs" color="bg-gradient-to-br from-orange-400 to-pink-500" />
        <StatCard icon="🛏️" number={availableRooms.length} label="Available" color="bg-gradient-to-br from-blue-400 to-purple-500" />
        <StatCard icon="📋" number={pendingBookings.length} label="Pending" color="bg-gradient-to-br from-brass to-yellow-500" />
      </StatsRow>

      <SectionHeader title="Today's Schedule" count={`${todayCheckIns.length + todayCheckOuts.length} total`} />
      <div className="space-y-2">
        {todayCheckIns.slice(0, 3).map((b: any) => (
          <TaskCard
            key={b.id}
            icon="✅"
            iconBg="bg-emerald-50"
            title={b.guests?.name || 'Guest'}
            meta={`Room ${b.rooms?.room_number} · Check-in · ${b.num_adults} adult(s)`}
            status="In"
            statusColor="bg-emerald-100 text-emerald-700"
          />
        ))}
        {todayCheckOuts.slice(0, 3).map((b: any) => (
          <TaskCard
            key={b.id}
            icon="🚪"
            iconBg="bg-amber-50"
            title={b.guests?.name || 'Guest'}
            meta={`Room ${b.rooms?.room_number} · Check-out`}
            status="Out"
            statusColor="bg-amber-100 text-amber-700"
          />
        ))}
        {todayCheckIns.length === 0 && todayCheckOuts.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No activity today</p>
        )}
      </div>
    </div>
  );
}
