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
  sendReconciliationAuditReport,
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

  const reconciliationAuditReport = async (adminEmails: string[]) => {
    setSending(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // Fetch all shifts for today
      const { data: shifts } = await sb
        .from('staff_shifts')
        .select('id, user_id, shift_name, shift_date, status, start_time, end_time, users:user_id(full_name, role), departments:department_id(name)')
        .gte('shift_date', yesterday)
        .lte('shift_date', today)
        .order('shift_date', { ascending: false });

      if (!shifts || shifts.length === 0) return { success: false, error: 'No shifts found' };

      // Fetch all reconciliations for these shifts
      const shiftIds = shifts.map((s: any) => s.id);
      const { data: recons } = await sb
        .from('shift_reconciliations')
        .select('*')
        .in('shift_id', shiftIds)
        .order('created_at', { ascending: false });

      // Fetch payments for today
      const { data: payments } = await sb
        .from('payments')
        .select('id, amount, method, mpesa_transaction_id, created_at')
        .gte('created_at', yesterday)
        .lte('created_at', today + 'T23:59:59');

      const allPayments = payments || [];
      const totalRevenue = allPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const cashCollected = allPayments.filter((p: any) => p.method === 'cash').reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const mpesaCollected = allPayments.filter((p: any) => p.method === 'mpesa').reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const cardCollected = allPayments.filter((p: any) => p.method === 'card').reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const mpesaCodesCount = allPayments.filter((p: any) => p.mpesa_transaction_id).length;

      // Build shift report data
      const shiftReport = shifts.map((s: any) => {
        const recon = recons?.find((r: any) => r.shift_id === s.id);
        return {
          staffName: s.users?.full_name || 'Staff',
          role: s.users?.role || 'unknown',
          shiftName: s.shift_name || '—',
          salesTotal: Number(recon?.sales_total || 0),
          cashTotal: Number(recon?.cash_total || 0),
          mpesaTotal: Number(recon?.mpesa_total || 0),
          variance: Number(recon?.variance || 0),
          varianceStatus: recon?.variance_status || 'none',
          status: recon?.status || s.status || 'unknown',
          explanation: recon?.variance_explanation || undefined,
          proofType: recon?.variance_proof_type || undefined,
          adminConfirmed: recon?.variance_admin_confirmed || false,
        };
      });

      const unresolvedCount = shiftReport.filter(s => s.varianceStatus === 'open' || s.varianceStatus === 'staff_explained').length;
      const resolvedCount = shiftReport.filter(s => s.varianceStatus === 'resolved' || s.varianceStatus === 'none').length;

      const reportData = {
        date: today,
        totalRevenue,
        cashCollected,
        mpesaCollected,
        cardCollected,
        totalPayments: allPayments.length,
        mpesaCodesCount,
        shifts: shiftReport,
        unresolvedCount,
        resolvedCount,
        totalShifts: shifts.length,
      };

      // Send to each admin/manager
      const results = [];
      for (const email of adminEmails) {
        const r = await sendReconciliationAuditReport(email, reportData);
        results.push({ email, ...r });
      }
      return { success: results.every(r => r.success), results, report: reportData };
    } finally {
      setSending(false);
    }
  };

  return { otp, welcome, booking, checkIn, checkout, passwordReset, dailyReport, reconciliationAuditReport, sending };
}
