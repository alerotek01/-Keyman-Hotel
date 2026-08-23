import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  sendOTPVerification,
  sendWelcomeEmail,
  sendBookingConfirmation,
  sendCheckInEmail,
  sendCheckoutReceipt,
  sendDailyReport,
  sendPasswordReset,
} from '@/lib/email';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useEmailService() {
  const [sending, setSending] = useState(false);

  const otp = async (email: string, name: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await sb.from('otp_codes').upsert({ email, code, expires_at: new Date(Date.now() + 3600000).toISOString() }, { onConflict: 'email' });
    return { ...await sendOTPVerification(email, code, name), code };
  };

  const welcome = async (email: string, name: string, role: string, tempPassword?: string) => {
    return sendWelcomeEmail(email, name, role, tempPassword);
  };

  const booking = async (email: string, guestName: string, roomType: string, checkIn: string, checkOut: string, total: number, deposit: number, paymentType: string) => {
    return sendBookingConfirmation(email, guestName, roomType, checkIn, checkOut, total, deposit, paymentType);
  };

  const checkIn = async (email: string, guestName: string, roomNumber: string | number) => {
    return sendCheckInEmail(email, guestName, roomNumber);
  };

  const checkout = async (email: string, guestName: string, roomNumber: string | number, checkIn: string, checkOut: string, charges: { description: string; amount: number }[], totalCharges: number, totalPaid: number, balance: number) => {
    return sendCheckoutReceipt(email, guestName, roomNumber, checkIn, checkOut, charges, totalCharges, totalPaid, balance);
  };

  const passwordReset = async (email: string, resetLink: string, name: string) => {
    return sendPasswordReset(email, resetLink, name);
  };

  const dailyReport = async (adminEmails: string[]) => {
    setSending(true);
    try {
      // Generate report from DB
      const { data: report } = await sb.rpc('generate_daily_report');
      if (!report) return { success: false, error: 'No report generated' };

      // Send to each admin
      const results = [];
      for (const email of adminEmails) {
        const r = await sendDailyReport(email, report);
        results.push({ email, ...r });
      }
      return { success: results.every(r => r.success), results };
    } finally {
      setSending(false);
    }
  };

  return { otp, welcome, booking, checkIn, checkout, passwordReset, dailyReport, sending };
}
