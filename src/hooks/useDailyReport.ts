import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface DailyReportData {
  // Occupancy
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  dirtyRooms: number;
  outOfOrderRooms: number;
  occupancyRate: number;

  // Revenue (from folio transactions)
  totalCharges: number;
  roomCharges: number;
  restaurantCharges: number;
  serviceCharges: number;
  totalPayments: number;
  mpesaPayments: number;
  cashPayments: number;
  cardPayments: number;

  // Bookings
  totalReservations: number;
  newBookings: number;
  checkedInToday: number;
  checkedOutToday: number;
  cancellations: number;

  // Restaurant
  totalOrders: number;
  ordersDelivered: number;
  ordersPending: number;
  ordersCancelled: number;
  restaurantRevenue: number;

  // Housekeeping
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;

  // Daily breakdown
  dailyOccupancy: Array<{ date: string; occupied: number; total: number; rate: number }>;
  dailyRevenue: Array<{ date: string; charges: number; payments: number }>;
  dailyOrders: Array<{ date: string; count: number; revenue: number }>;
}

export function useDailyReport(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['daily-report', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<DailyReportData> => {
      const from = startDate ? startOfDay(startDate) : startOfDay(new Date());
      const to = endDate ? endOfDay(endDate) : endOfDay(new Date());
      const fromStr = format(from, 'yyyy-MM-dd');
      const toStr = format(to, 'yyyy-MM-dd');

      // Parallel queries for performance
      const [
        roomsRes,
        reservationsRes,
        folioTxnRes,
        folioPayRes,
        ordersRes,
        housekeepingRes,
      ] = await Promise.all([
        // 1. All active rooms
        sb.from('rooms').select('id, status, room_type_id').eq('is_active', true),

        // 2. Reservations in date range
        sb.from('reservations').select('*, room_types(name)').gte('check_in', fromStr).lte('check_out', toStr),

        // 3. Folio transactions in date range
        sb.from('folio_transactions').select('type, amount, created_at').gte('created_at', from.toISOString()).lte('created_at', to.toISOString()),

        // 4. Folio payments in date range
        sb.from('folio_payments').select('method, amount, created_at').gte('created_at', from.toISOString()).lte('created_at', to.toISOString()),

        // 5. Restaurant orders in date range
        sb.from('restaurant_orders').select('id, status, total_amount, created_at').gte('created_at', from.toISOString()).lte('created_at', to.toISOString()),

        // 6. Housekeeping tasks in date range
        sb.from('housekeeping_tasks').select('id, status, shift_date, created_at').gte('shift_date', fromStr).lte('shift_date', toStr),
      ]);

      const rooms = roomsRes.data || [];
      const reservations = reservationsRes.data || [];
      const folioTxns = folioTxnRes.data || [];
      const folioPays = folioPayRes.data || [];
      const orders = ordersRes.data || [];
      const housekeeping = housekeepingRes.data || [];

      // ── Occupancy ──
      const occupiedRooms = rooms.filter((r: any) => r.status === 'occupied').length;
      const availableRooms = rooms.filter((r: any) => r.status === 'available').length;
      const dirtyRooms = rooms.filter((r: any) => r.status === 'dirty').length;
      const outOfOrderRooms = rooms.filter((r: any) => ['out_of_order', 'maintenance'].includes(r.status)).length;
      const totalRooms = rooms.length;

      // ── Revenue ──
      const totalCharges = folioTxns.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const roomCharges = folioTxns.filter((t: any) => t.type === 'room_charge').reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const restaurantCharges = folioTxns.filter((t: any) => t.type === 'restaurant_charge').reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const serviceCharges = folioTxns.filter((t: any) => t.type === 'service_charge').reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const totalPayments = folioPays.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const mpesaPayments = folioPays.filter((p: any) => p.method === 'mpesa').reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const cashPayments = folioPays.filter((p: any) => p.method === 'cash').reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const cardPayments = folioPays.filter((p: any) => p.method === 'card').reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      // ── Bookings ──
      const totalReservations = reservations.length;
      const newBookings = reservations.filter((r: any) => r.created_at >= from.toISOString() && r.created_at <= to.toISOString()).length;
      const checkedInToday = reservations.filter((r: any) => r.status === 'checked_in').length;
      const checkedOutToday = reservations.filter((r: any) => r.status === 'checked_out').length;
      const cancellations = reservations.filter((r: any) => r.status === 'cancelled').length;

      // ── Restaurant ──
      const totalOrders = orders.length;
      const ordersDelivered = orders.filter((o: any) => ['delivered', 'payment_verified', 'reconciled'].includes(o.status)).length;
      const ordersPending = orders.filter((o: any) => ['new', 'accepted', 'kitchen_accepted', 'preparing', 'ready'].includes(o.status)).length;
      const ordersCancelled = orders.filter((o: any) => o.status === 'cancelled').length;
      const restaurantRevenue = orders.filter((o: any) => !['cancelled', 'rejected'].includes(o.status)).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

      // ── Housekeeping ──
      const totalTasks = housekeeping.length;
      const pendingTasks = housekeeping.filter((t: any) => t.status === 'pending').length;
      const inProgressTasks = housekeeping.filter((t: any) => t.status === 'in_progress').length;
      const completedTasks = housekeeping.filter((t: any) => t.status === 'completed').length;

      // ── Daily breakdown (last 7 days) ──
      const dailyOccupancy = [];
      const dailyRevenue = [];
      const dailyOrders = [];
      for (let i = 6; i >= 0; i--) {
        const day = subDays(new Date(), i);
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);

        // Occupancy for this day
        const dayOccupied = rooms.filter((r: any) => r.status === 'occupied').length; // simplified
        dailyOccupancy.push({
          date: dayStr,
          occupied: dayOccupied,
          total: totalRooms,
          rate: totalRooms > 0 ? (dayOccupied / totalRooms) * 100 : 0,
        });

        // Revenue for this day
        const dayCharges = folioTxns.filter((t: any) => {
          const d = new Date(t.created_at);
          return d >= dayStart && d <= dayEnd;
        }).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        const dayPayments = folioPays.filter((p: any) => {
          const d = new Date(p.created_at);
          return d >= dayStart && d <= dayEnd;
        }).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        dailyRevenue.push({ date: dayStr, charges: dayCharges, payments: dayPayments });

        // Orders for this day
        const dayOrders = orders.filter((o: any) => {
          const d = new Date(o.created_at);
          return d >= dayStart && d <= dayEnd;
        });
        dailyOrders.push({
          date: dayStr,
          count: dayOrders.length,
          revenue: dayOrders.filter((o: any) => !['cancelled', 'rejected'].includes(o.status)).reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0),
        });
      }

      return {
        totalRooms,
        occupiedRooms,
        availableRooms,
        dirtyRooms,
        outOfOrderRooms,
        occupancyRate: totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0,
        totalCharges,
        roomCharges,
        restaurantCharges,
        serviceCharges,
        totalPayments,
        mpesaPayments,
        cashPayments,
        cardPayments,
        totalReservations,
        newBookings,
        checkedInToday,
        checkedOutToday,
        cancellations,
        totalOrders,
        ordersDelivered,
        ordersPending,
        ordersCancelled,
        restaurantRevenue,
        totalTasks,
        pendingTasks,
        inProgressTasks,
        completedTasks,
        dailyOccupancy,
        dailyRevenue,
        dailyOrders,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
