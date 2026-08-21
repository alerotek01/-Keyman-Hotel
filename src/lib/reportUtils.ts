import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, differenceInDays, parseISO } from 'date-fns';
import type { Booking, Room, OccupancyReport, RevenueReport, GuestInsight } from './types';
import { formatCurrency, getRoomTypeLabel } from './utils';

// Calculate occupancy reports
export function calculateOccupancy(
  bookings: Booking[],
  rooms: Room[],
  startDate: Date,
  endDate: Date
): OccupancyReport[] {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const totalRoomCount = rooms.filter(r => r.is_active).length;

  return days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const occupiedRooms = bookings.filter(b => {
      if (b.status === 'cancelled') return false;
      return b.check_in <= dayStr && b.check_out > dayStr;
    }).length;

    return {
      date: dayStr,
      totalRooms: totalRoomCount,
      occupiedRooms,
      occupancyRate: totalRoomCount > 0 ? (occupiedRooms / totalRoomCount) * 100 : 0,
    };
  });
}

// Calculate revenue reports
export function calculateRevenue(bookings: Booking[], period: 'daily' | 'monthly'): RevenueReport[] {
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');

  const grouped = confirmedBookings.reduce((acc, booking) => {
    const key = period === 'daily'
      ? booking.check_in
      : format(parseISO(booking.check_in), 'yyyy-MM');

    if (!acc[key]) {
      acc[key] = { revenue: 0, count: 0 };
    }
    acc[key].revenue += Number(booking.rate);
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { revenue: number; count: number }>);

  return Object.entries(grouped)
    .map(([period, data]) => ({
      period,
      totalRevenue: data.revenue,
      confirmedBookings: data.count,
      averageBookingValue: data.count > 0 ? data.revenue / data.count : 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

// Calculate guest insights
export function calculateGuestInsights(bookings: Booking[]): GuestInsight {
  const confirmedBookings = bookings.filter(b => b.status !== 'cancelled');

  const totalGuests = confirmedBookings.reduce((acc, b) => acc + b.num_adults + b.num_children, 0);

  const totalNights = confirmedBookings.reduce((acc, b) => {
    return acc + differenceInDays(parseISO(b.check_out), parseISO(b.check_in));
  }, 0);

  const roomTypeDistribution = confirmedBookings.reduce((acc, b) => {
    const roomType = b.room_types?.name || 'Unknown';
    acc[roomType] = (acc[roomType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalGuests,
    guestsWithVehicle: 0,
    guestsWithBreakfast: 0,
    averageStayLength: confirmedBookings.length > 0 ? totalNights / confirmedBookings.length : 0,
    roomTypeDistribution,
  };
}

// Import eachDayOfInterval for occupancy calculation
import { eachDayOfInterval } from 'date-fns';

// Generate PDF reports
export function generateOccupancyPDF(data: OccupancyReport[], title: string): void {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text('Keyman Hotel', 14, 20);
  doc.setFontSize(16);
  doc.text(title, 14, 30);
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 38);

  const avgOccupancy = data.reduce((acc, d) => acc + d.occupancyRate, 0) / (data.length || 1);
  doc.setFontSize(12);
  doc.text(`Average Occupancy: ${avgOccupancy.toFixed(1)}%`, 14, 48);

  autoTable(doc, {
    startY: 55,
    head: [['Date', 'Total Rooms', 'Occupied', 'Occupancy Rate']],
    body: data.map(row => [
      format(parseISO(row.date), 'MMM d, yyyy'),
      row.totalRooms.toString(),
      row.occupiedRooms.toString(),
      `${row.occupancyRate.toFixed(1)}%`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 95] },
  });

  doc.save(`occupancy-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function generateRevenuePDF(data: RevenueReport[], title: string): void {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text('Keyman Hotel', 14, 20);
  doc.setFontSize(16);
  doc.text(title, 14, 30);
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 38);

  const totalRevenue = data.reduce((acc, d) => acc + d.totalRevenue, 0);
  const totalBookings = data.reduce((acc, d) => acc + d.confirmedBookings, 0);
  doc.setFontSize(12);
  doc.text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 14, 48);
  doc.text(`Total Bookings: ${totalBookings}`, 14, 56);

  autoTable(doc, {
    startY: 65,
    head: [['Period', 'Revenue', 'Bookings', 'Avg. Value']],
    body: data.map(row => [
      row.period,
      formatCurrency(row.totalRevenue),
      row.confirmedBookings.toString(),
      formatCurrency(row.averageBookingValue),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 95] },
  });

  doc.save(`revenue-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function generateGuestInsightsPDF(data: GuestInsight, bookings: Booking[], title: string): void {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text('Keyman Hotel', 14, 20);
  doc.setFontSize(16);
  doc.text(title, 14, 30);
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 38);

  doc.setFontSize(12);
  let yPos = 50;
  doc.text(`Total Guests: ${data.totalGuests}`, 14, yPos);
  yPos += 8;
  doc.text(`Average Stay Length: ${data.averageStayLength.toFixed(1)} nights`, 14, yPos);
  yPos += 12;

  doc.text('Room Type Distribution:', 14, yPos);
  yPos += 8;
  Object.entries(data.roomTypeDistribution).forEach(([type, count]) => {
    doc.text(`  ${getRoomTypeLabel(type)}: ${count} bookings`, 14, yPos);
    yPos += 6;
  });

  doc.save(`guest-insights-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function generateBookingsPDF(bookings: Booking[], title: string): void {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text('Keyman Hotel', 14, 20);
  doc.setFontSize(16);
  doc.text(title, 14, 30);
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 38);

  autoTable(doc, {
    startY: 45,
    head: [['Guest', 'Room', 'Check-in', 'Check-out', 'Guests', 'Amount', 'Status']],
    body: bookings.map(b => [
      b.guests?.name || 'N/A',
      `Room ${b.rooms?.room_number}`,
      format(parseISO(b.check_in), 'MMM d'),
      format(parseISO(b.check_out), 'MMM d'),
      (b.num_adults + b.num_children).toString(),
      formatCurrency(Number(b.rate)),
      b.status,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 95] },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 25 },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 15 },
      5: { cellWidth: 28 },
      6: { cellWidth: 22 },
    },
  });

  doc.save(`bookings-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function generateBusinessDeckPDF(
  bookings: Booking[],
  rooms: Room[],
  occupancyData: OccupancyReport[],
  revenueData: RevenueReport[],
  guestInsights: GuestInsight
): void {
  const doc = new jsPDF();

  // Title Page
  doc.setFontSize(32);
  doc.text('Keyman Hotel', 105, 80, { align: 'center' });
  doc.setFontSize(24);
  doc.text('Business Analysis Report', 105, 100, { align: 'center' });
  doc.setFontSize(14);
  doc.text(format(new Date(), 'MMMM yyyy'), 105, 120, { align: 'center' });

  // Executive Summary
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Executive Summary', 14, 20);

  const totalRevenue = revenueData.reduce((acc, d) => acc + d.totalRevenue, 0);
  const totalBookings = bookings.filter(b => b.status === 'confirmed').length;
  const avgOccupancy = occupancyData.reduce((acc, d) => acc + d.occupancyRate, 0) / (occupancyData.length || 1);

  doc.setFontSize(12);
  let y = 35;
  doc.text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 14, y); y += 10;
  doc.text(`Confirmed Bookings: ${totalBookings}`, 14, y); y += 10;
  doc.text(`Average Occupancy Rate: ${avgOccupancy.toFixed(1)}%`, 14, y); y += 10;
  doc.text(`Total Guests Served: ${guestInsights.totalGuests}`, 14, y); y += 10;
  doc.text(`Average Stay Length: ${guestInsights.averageStayLength.toFixed(1)} nights`, 14, y); y += 15;

  // Room Distribution
  doc.setFontSize(16);
  doc.text('Room Type Performance', 14, y); y += 10;
  doc.setFontSize(11);
  Object.entries(guestInsights.roomTypeDistribution).forEach(([type, count]) => {
    doc.text(`• ${getRoomTypeLabel(type)}: ${count} bookings`, 14, y);
    y += 8;
  });

  // Revenue Page
  doc.addPage();
  doc.setFontSize(20);
  doc.text('Revenue Analysis', 14, 20);

  autoTable(doc, {
    startY: 30,
    head: [['Period', 'Revenue', 'Bookings', 'Avg. Booking Value']],
    body: revenueData.slice(0, 12).map(row => [
      row.period,
      formatCurrency(row.totalRevenue),
      row.confirmedBookings.toString(),
      formatCurrency(row.averageBookingValue),
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [30, 58, 95] },
  });

  doc.save(`keyman-hotel-business-analysis-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
