import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBookings } from '@/hooks/useBookings';
import { useAllRooms } from '@/hooks/useRooms';
import { formatCurrency, getRoomTypeLabel } from '@/lib/utils';
import { 
  calculateOccupancy, 
  calculateRevenue, 
  calculateGuestInsights,
  generateOccupancyPDF,
  generateRevenuePDF,
  generateGuestInsightsPDF,
  generateBookingsPDF,
  generateBusinessDeckPDF
} from '@/lib/reportUtils';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { 
  CalendarIcon, 
  Download, 
  TrendingUp, 
  Users, 
  BedDouble, 
  Car, 
  Coffee,
  FileText,
  Loader2,
  BarChart3 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReconciliationAnalytics from '@/pages/manager/ReconciliationAnalytics';
import RoomPerformance from '@/pages/admin/RoomPerformance';
import MenuAnalytics from '@/pages/admin/MenuAnalytics';
import TemporalForecasting from '@/pages/admin/TemporalForecasting';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const CHART_COLORS = ['#1E3A5F', '#D4AF37', '#2A5A8A', '#E5C158', '#3B7BB9'];

export default function Reports() {
  const { data: bookings, isLoading: bookingsLoading } = useBookings();
  const { data: rooms, isLoading: roomsLoading } = useAllRooms();
  const { data: orders } = useQuery({
    queryKey: ['report-orders'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('restaurant_orders').select('id, total, created_at, status');
      return data || [];
    },
  });
  
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const isLoading = bookingsLoading || roomsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const occupancyData = calculateOccupancy(bookings || [], rooms || [], dateRange.from, dateRange.to);
  const revenueData = calculateRevenue(bookings || [], 'monthly');
  const guestInsights = calculateGuestInsights(bookings || []);

  const avgOccupancy = occupancyData.reduce((acc, d) => acc + d.occupancyRate, 0) / (occupancyData.length || 1);
  const totalRevenue = revenueData.reduce((acc, d) => acc + d.totalRevenue, 0);

  const roomTypeData = Object.entries(guestInsights.roomTypeDistribution).map(([type, count]) => ({
    name: getRoomTypeLabel(type),
    value: count,
  }));

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">Comprehensive hotel performance insights</p>
        </div>
        
        <div className="flex gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button 
            variant="brass"
            onClick={() => generateBusinessDeckPDF(
              bookings || [],
              rooms || [],
              occupancyData,
              revenueData,
              guestInsights
            )}
          >
            <FileText className="mr-2 h-4 w-4" />
            Download Business Deck
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Occupancy</CardTitle>
            <BedDouble className="h-4 w-4 text-brass" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgOccupancy.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">All time confirmed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Guests with Vehicle</CardTitle>
            <Car className="h-4 w-4 text-brass" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{guestInsights.guestsWithVehicle}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((guestInsights.guestsWithVehicle / (guestInsights.totalGuests || 1)) * 100).toFixed(1)}% of guests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Breakfast Add-ons</CardTitle>
            <Coffee className="h-4 w-4 text-brass" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{guestInsights.guestsWithBreakfast}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((guestInsights.guestsWithBreakfast / (guestInsights.totalGuests || 1)) * 100).toFixed(1)}% uptake
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="occupancy" className="space-y-6">
        <TabsList>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="guests">Guest Insights</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="rooms">Room Performance</TabsTrigger>
          <TabsTrigger value="menu">Menu Analytics</TabsTrigger>
          <TabsTrigger value="forecast">Forecasting</TabsTrigger>
        </TabsList>

        <TabsContent value="occupancy" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Occupancy Rate</CardTitle>
                <CardDescription>Daily occupancy for selected period</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generateOccupancyPDF(occupancyData, 'Occupancy Report')}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={occupancyData.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(new Date(val), 'MMM d')}
                      fontSize={12}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tickFormatter={(val) => `${val}%`}
                      fontSize={12}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Occupancy']}
                      labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                    />
                    <Bar dataKey="occupancyRate" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Monthly Revenue</CardTitle>
                <CardDescription>Revenue from confirmed bookings</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generateRevenuePDF(revenueData, 'Revenue Report')}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="period" 
                      tickFormatter={(val) => format(new Date(val + '-01'), 'MMM yy')}
                      fontSize={12}
                    />
                    <YAxis 
                      tickFormatter={(val) => formatCurrency(val).replace('KES', '')}
                      fontSize={12}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      labelFormatter={(label) => format(new Date(label + '-01'), 'MMMM yyyy')}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="totalRevenue" 
                      stroke="#D4AF37" 
                      strokeWidth={3}
                      dot={{ fill: '#D4AF37' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guests" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Guest Insights</CardTitle>
                  <CardDescription>Overall guest statistics</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => generateGuestInsightsPDF(guestInsights, bookings || [], 'Guest Insights Report')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-brass" />
                    <span>Total Guests</span>
                  </div>
                  <span className="font-bold">{guestInsights.totalGuests}</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Car className="h-5 w-5 text-brass" />
                    <span>With Vehicle</span>
                  </div>
                  <span className="font-bold">{guestInsights.guestsWithVehicle}</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Coffee className="h-5 w-5 text-brass" />
                    <span>With Breakfast</span>
                  </div>
                  <span className="font-bold">{guestInsights.guestsWithBreakfast}</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-brass" />
                    <span>Avg. Stay Length</span>
                  </div>
                  <span className="font-bold">{guestInsights.averageStayLength.toFixed(1)} nights</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Room Type Distribution</CardTitle>
                <CardDescription>Bookings by room type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={roomTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {roomTypeData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bookings" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>All Bookings</CardTitle>
                <CardDescription>Complete booking list</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generateBookingsPDF(bookings || [], 'All Bookings Report')}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </CardHeader>
            <CardContent>
              {(bookings?.length || 0) === 0 ? (
                <p className="text-muted-foreground text-center py-8">No bookings yet</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-auto">
                  {bookings?.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{booking.guests?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Room {booking.rooms?.room_number} • {format(new Date(booking.check_in), 'MMM d')} - {format(new Date(booking.check_out), 'MMM d')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(Number(booking.rate))}</p>
                        <span className={cn(
                          'text-xs px-2 py-1 rounded-full',
                          booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                          booking.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        )}>
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-6">
          <ReconciliationAnalytics />
        </TabsContent>

        <TabsContent value="rooms" className="space-y-6">
          <RoomPerformance bookings={bookings || []} rooms={rooms || []} />
        </TabsContent>

        <TabsContent value="menu" className="space-y-6">
          <MenuAnalytics />
        </TabsContent>

        <TabsContent value="forecast" className="space-y-6">
          <TemporalForecasting bookings={bookings || []} orders={orders || []} rooms={rooms || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
