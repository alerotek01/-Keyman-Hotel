import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export function useBusinessDeckExecutive(date?: string) {
  return useQuery({
    queryKey: ['deck-executive', date],
    queryFn: async () => {
      const { data, error } = await sb.rpc('get_business_deck_executive', { p_date: date || new Date().toISOString().split('T')[0] });
      if (error) throw error;
      return data;
    }
  });
}

export function useBusinessDeckRevenue(date?: string) {
  return useQuery({
    queryKey: ['deck-revenue', date],
    queryFn: async () => {
      const { data, error } = await sb.rpc('get_business_deck_revenue', { p_date: date || new Date().toISOString().split('T')[0] });
      if (error) throw error;
      return data;
    }
  });
}

export function useBusinessDeckOccupancy(date?: string) {
  return useQuery({
    queryKey: ['deck-occupancy', date],
    queryFn: async () => {
      const { data, error } = await sb.rpc('get_business_deck_occupancy', { p_date: date || new Date().toISOString().split('T')[0] });
      if (error) throw error;
      return data;
    }
  });
}

export function useBusinessDeckKitchen(date?: string) {
  return useQuery({
    queryKey: ['deck-kitchen', date],
    queryFn: async () => {
      const { data, error } = await sb.rpc('get_business_deck_kitchen', { p_date: date || new Date().toISOString().split('T')[0] });
      if (error) throw error;
      return data;
    }
  });
}

export function useBusinessDeckStaff(date?: string) {
  return useQuery({
    queryKey: ['deck-staff', date],
    queryFn: async () => {
      const { data, error } = await sb.rpc('get_business_deck_staff', { p_date: date || new Date().toISOString().split('T')[0] });
      if (error) throw error;
      return data;
    }
  });
}

export function useBusinessDeckGuests(date?: string) {
  return useQuery({
    queryKey: ['deck-guests', date],
    queryFn: async () => {
      const { data, error } = await sb.rpc('get_business_deck_guests', { p_date: date || new Date().toISOString().split('T')[0] });
      if (error) throw error;
      return data;
    }
  });
}

export function useBusinessDeckPayments(date?: string) {
  return useQuery({
    queryKey: ['deck-payments', date],
    queryFn: async () => {
      const { data, error } = await sb.rpc('get_business_deck_payments', { p_date: date || new Date().toISOString().split('T')[0] });
      if (error) throw error;
      return data;
    }
  });
}

export function useBusinessInsights(date?: string) {
  return useQuery({
    queryKey: ['deck-insights', date],
    queryFn: async () => {
      const { data, error } = await sb.rpc('get_business_insights', { p_date: date || new Date().toISOString().split('T')[0] });
      if (error) throw error;
      return data;
    }
  });
}

export function useBusinessDeckForecast(date?: string) {
  return useQuery({
    queryKey: ['deck-forecast', date],
    queryFn: async () => {
      const { data, error } = await sb.rpc('get_business_deck_forecast', { p_date: date || new Date().toISOString().split('T')[0] });
      if (error) throw error;
      return data;
    }
  });
}
