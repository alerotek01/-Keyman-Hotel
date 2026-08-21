export type RoomType = 'SINGLE' | 'STUDIO' | 'TWIN' | 'CONFERENCE' | 'CAFETERIA';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled';
export type AppRole = 'admin' | 'manager' | 'staff' | 'public';
export type RequestType = 'housekeeping' | 'maintenance' | 'room_service' | 'other';
export type RequestStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Room {
  id: string;
  room_number: number;
  room_type: RoomType;
  description: string | null;
  base_price: number;
  breakfast_price: number;
  total_rooms: number;
  is_active: boolean;
  created_at: string;
  room_images?: RoomImage[];
}

export interface RoomImage {
  id: string;
  room_id: string;
  image_url: string;
  created_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export interface Booking {
  id: string;
  room_id: string;
  customer_id: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  breakfast: boolean;
  vehicle: boolean;
  base_price: number;
  extras_price: number;
  total_amount: number;
  status: BookingStatus;
  created_at: string;
  rooms?: Room;
  customers?: Customer;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  actor: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export interface RoomWithAvailability extends Room {
  available_count: number;
}

export interface BookingFormData {
  room_id: string;
  check_in: Date;
  check_out: Date;
  guests_count: number;
  breakfast: boolean;
  vehicle: boolean;
  customer_name: string;
  customer_email: string;
}

export interface PriceCalculation {
  nights: number;
  base_cost: number;
  breakfast_cost: number;
  vehicle_cost: number;
  total: number;
}

export interface GuestRequest {
  id: string;
  booking_id: string;
  request_type: RequestType;
  description: string | null;
  status: RequestStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  bookings?: Booking;
}

export interface Receipt {
  id: string;
  booking_id: string;
  receipt_url: string;
  uploaded_by: string | null;
  notes: string | null;
  created_at: string;
  bookings?: Booking;
}

// Report types
export interface OccupancyReport {
  date: string;
  totalRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
}

export interface RevenueReport {
  period: string;
  totalRevenue: number;
  confirmedBookings: number;
  averageBookingValue: number;
}

export interface GuestInsight {
  totalGuests: number;
  guestsWithVehicle: number;
  guestsWithBreakfast: number;
  averageStayLength: number;
  roomTypeDistribution: Record<string, number>;
}
