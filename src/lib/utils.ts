import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInDays } from "date-fns";
import type { PriceCalculation } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateBookingPrice(
  basePrice: number,
  breakfastPrice: number,
  checkIn: Date,
  checkOut: Date,
  guestsCount: number,
  includeBreakfast: boolean
): PriceCalculation {
  const nights = differenceInDays(checkOut, checkIn);
  const base_cost = basePrice * nights;
  const breakfast_cost = includeBreakfast ? guestsCount * breakfastPrice * nights : 0;
  const vehicle_cost = 0; // FREE PARKING
  const total = base_cost + breakfast_cost + vehicle_cost;

  return {
    nights,
    base_cost,
    breakfast_cost,
    vehicle_cost,
    total,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('KES', 'KSH');
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function getRoomTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    SINGLE: 'Single Room',
    STUDIO: 'Studio Suite',
    TWIN: 'Twin Room',
    CONFERENCE: 'Conference Hall',
    CAFETERIA: 'Cafeteria',
  };
  return labels[type] || type;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-800',
    Confirmed: 'bg-emerald-100 text-emerald-800',
    Cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}
