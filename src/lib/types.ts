// ===== New Schema Types (Stage 0) =====
export type AppRole = 'admin' | 'manager' | 'receptionist' | 'waiter' | 'chef' | 'housekeeper' | 'storekeeper' | 'maintenance' | 'accountant';
export type ReservationStatus = 'inquiry' | 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
export type BookingSource = 'direct' | 'website' | 'phone' | 'walk_in' | 'ota';
export type RoomStatus = 'available' | 'reserved' | 'occupied' | 'dirty' | 'cleaning' | 'inspected' | 'out_of_order' | 'maintenance';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface HotelUser {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  department_id: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RoomTypeEntry {
  id: string;
  name: string;
  description: string | null;
  base_rate: number;
  max_occupancy: number;
  breakfast_price: number;
  is_active: boolean;
  created_at: string;
}

export interface Room {
  id: string;
  room_number: number;
  room_type_id: string;
  floor: number;
  status: RoomStatus;
  base_price: number;
  is_active: boolean;
  created_at: string;
  room_images?: RoomImage[];
  room_types?: RoomTypeEntry;
  // Legacy compat — populated from room_types join
  room_type?: string;
  breakfast_price?: number;
}

export interface RoomImage {
  id: string;
  room_id: string;
  image_url: string;
  sort_order: number;
  alt_text: string | null;
  created_at: string;
}

export interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  id_type: string | null;
  id_number: string | null;
  nationality: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
}

export interface Reservation {
  id: string;
  guest_id: string;
  room_id: string | null;
  room_type_id: string;
  check_in: string;
  check_out: string;
  num_adults: number;
  num_children: number;
  rate: number;
  source: BookingSource;
  status: ReservationStatus;
  deposit_amount: number;
  payment_status: string;
  special_requests: string | null;
  cancellation_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  guests?: Guest;
  rooms?: Room;
  room_types?: RoomTypeEntry;
}

// Alias for backward compatibility
export type BookingStatus = ReservationStatus;
export type Booking = Reservation;
export type Customer = Guest;
export type BookingFormData = ReservationFormData;

export interface ReservationFormData {
  room_type_id: string;
  check_in: Date;
  check_out: Date;
  num_adults: number;
  num_children: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  special_requests?: string;
}

export interface RoomWithAvailability extends Room {
  available_count: number;
}

export interface PriceCalculation {
  nights: number;
  base_cost: number;
  breakfast_cost: number;
  vehicle_cost: number;
  total: number;
  vat_amount: number;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export type RequestType = 'housekeeping' | 'maintenance' | 'room_service' | 'other';
export type RequestStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface GuestRequest {
  id: string;
  reservation_id: string;
  request_type: RequestType;
  description: string | null;
  priority: string;
  status: RequestStatus;
  assigned_to: string | null;
  completed_at: string | null;
  created_at: string;
  // Joined
  reservations?: Reservation;
  bookings?: Reservation; // compat alias
}

export interface AuditLog {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  user_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
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
