/**
 * Email Service — Resend API Integration
 * 
 * Handles:
 * - Guest OTP signup verification
 * - Password reset emails
 * - Welcome emails (when admin creates user)
 * - Daily operational reports (midnight)
 */

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || '';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM_EMAIL = 'Keyman Hotel <nonreply@alerotek.co.ke>';
const HOTEL_NAME = 'Keyman Hotel';
const HOTEL_URL = import.meta.env.VITE_SITE_URL || 'https://keymanhotel.alerotek.co.ke';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Send email via Resend API
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not configured — email skipped');
    return { success: false, error: 'API key not configured' };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        reply_to: options.replyTo,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, id: data.id };
    } else {
      console.error('[Email] Send failed:', data);
      return { success: false, error: data.message || 'Unknown error' };
    }
  } catch (err: any) {
    console.error('[Email] Network error:', err.message);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════

function baseTemplate(content: string, footer?: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:#1a2744;padding:24px;text-align:center;">
          <h1 style="color:#c8a951;margin:0;font-size:24px;">🏨 ${HOTEL_NAME}</h1>
        </div>
        <div style="padding:32px;">
          ${content}
        </div>
        <div style="padding:16px;text-align:center;background:#f9f9f9;border-top:1px solid #eee;">
          <p style="color:#999;font-size:12px;margin:0;">
            ${footer || `${HOTEL_NAME} · Mwatate, Kenya · <a href="${HOTEL_URL}" style="color:#c8a951;">Visit Website</a>`}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Guest OTP verification email
 */
export async function sendOTPVerification(to: string, otpCode: string, guestName: string) {
  return sendEmail({
    to,
    subject: `Your Verification Code — ${HOTEL_NAME}`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">Welcome, ${guestName}!</h2>
      <p style="color:#555;line-height:1.6;">Use the code below to verify your email and access your guest dashboard:</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a2744;margin:0;">${otpCode}</p>
        <p style="color:#999;font-size:12px;margin-top:8px;">Expires in 1 hour</p>
      </div>
      <p style="color:#555;line-height:1.6;">If you didn't request this, please ignore this email.</p>
    `),
  });
}

/**
 * Password reset email
 */
export async function sendPasswordReset(to: string, resetLink: string, userName: string) {
  return sendEmail({
    to,
    subject: `Reset Your Password — ${HOTEL_NAME}`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">Password Reset</h2>
      <p style="color:#555;line-height:1.6;">Hi ${userName},</p>
      <p style="color:#555;line-height:1.6;">We received a request to reset your password. Click the button below to create a new one:</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resetLink}" style="background:#c8a951;color:#1a2744;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;display:inline-block;">Reset Password</a>
      </div>
      <p style="color:#999;font-size:12px;line-height:1.6;">This link expires in 24 hours. If you didn't request this, please ignore this email.</p>
    `),
  });
}

/**
 * Welcome email when admin creates a user
 */
export async function sendWelcomeEmail(to: string, userName: string, role: string, temporaryPassword?: string) {
  // Role-specific dashboard links
  const ROLE_DASHBOARDS: Record<string, string> = {
    admin: '/admin',
    manager: '/manager',
    receptionist: '/staff',
    waiter: '/staff',
    chef: '/staff',
    housekeeper: '/staff',
    accountant: '/admin',
    guest: '/guest',
    external_customer: '/external/order',
  };
  const dashboardPath = ROLE_DASHBOARDS[role] || '/staff';
  const dashboardUrl = `${HOTEL_URL}${dashboardPath}`;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ');

  return sendEmail({
    to,
    subject: `Welcome to ${HOTEL_NAME} — Your ${roleLabel} Account is Ready`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">Welcome, ${userName}! 👋</h2>
      <p style="color:#555;line-height:1.6;">Your <strong>${roleLabel}</strong> account has been created on the ${HOTEL_NAME} management system.</p>
      <div style="background:#e8f5e9;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
        <p style="color:#2e7d32;margin:0;font-size:14px;">🎯 Your Role: <strong>${roleLabel}</strong></p>
      </div>
      ${temporaryPassword ? `
        <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:20px 0;">
          <p style="color:#555;margin:0 0 8px;">Your login credentials:</p>
          <p style="color:#555;margin:0;"><strong>Email:</strong> ${to}</p>
          <p style="color:#555;margin:8px 0 0;"><strong>Password:</strong> <code style="background:#e8e8e8;padding:2px 6px;border-radius:4px;">${temporaryPassword}</code></p>
        </div>
        <p style="color:#e74c3c;font-size:13px;">⚠️ Please change your password after first login.</p>
      ` : ''}
      <div style="text-align:center;margin:24px 0;">
        <a href="${dashboardUrl}" style="background:#c8a951;color:#1a2744;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;display:inline-block;">Open ${roleLabel} Dashboard</a>
      </div>
      <p style="color:#999;font-size:12px;text-align:center;margin-top:12px;">Direct link: <a href="${dashboardUrl}" style="color:#c8a951;">${dashboardUrl}</a></p>
    `),
  });
}

/**
 * Booking confirmation email
 */
export async function sendBookingConfirmation(
  to: string,
  guestName: string,
  roomType: string,
  checkIn: string,
  checkOut: string,
  totalAmount: number,
  depositAmount: number,
  paymentType: string
) {
  const payText = paymentType === 'pay_now'
    ? `<p style="color:#e74c3c;font-weight:bold;">Full payment of KES ${totalAmount.toLocaleString()} is required now.</p>`
    : paymentType === 'deposit'
    ? `<p style="color:#d68910;font-weight:bold;">Deposit of KES ${depositAmount.toLocaleString()} (50%) is required now. Balance due at check-in.</p>`
    : `<p style="color:#27ae60;font-weight:bold;">Pay on arrival — no upfront payment needed.</p>`;

  return sendEmail({
    to,
    subject: `Booking Confirmed — ${HOTEL_NAME}`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">Booking Confirmed ✅</h2>
      <p style="color:#555;line-height:1.6;">Hi ${guestName},</p>
      <p style="color:#555;line-height:1.6;">Your reservation has been confirmed:</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#999;">Room Type</td><td style="padding:8px 0;color:#1a2744;font-weight:bold;">${roomType}</td></tr>
          <tr><td style="padding:8px 0;color:#999;">Check-in</td><td style="padding:8px 0;color:#1a2744;">${checkIn}</td></tr>
          <tr><td style="padding:8px 0;color:#999;">Check-out</td><td style="padding:8px 0;color:#1a2744;">${checkOut}</td></tr>
          <tr><td style="padding:8px 0;color:#999;">Total</td><td style="padding:8px 0;color:#1a2744;font-weight:bold;">KES ${totalAmount.toLocaleString()}</td></tr>
        </table>
      </div>
      ${payText}
      <div style="text-align:center;margin:24px 0;">
        <a href="${HOTEL_URL}/guest" style="background:#c8a951;color:#1a2744;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;display:inline-block;">View My Booking</a>
      </div>
    `),
  });
}

/**
 * Check-in notification email
 */
export async function sendCheckInEmail(to: string, guestName: string, roomNumber: string | number) {
  return sendEmail({
    to,
    subject: `You're Checked In — Room ${roomNumber}`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">Welcome to Your Room! 🔑</h2>
      <p style="color:#555;line-height:1.6;">Hi ${guestName},</p>
      <p style="color:#555;line-height:1.6;">You're now checked into <strong>Room ${roomNumber}</strong>.</p>
      <p style="color:#555;line-height:1.6;">Here's what you can do from your guest dashboard:</p>
      <ul style="color:#555;line-height:1.8;">
        <li>🍽️ Order food from the cafeteria</li>
        <li>💬 Chat with reception, kitchen & housekeeping</li>
        <li>📋 View your folio and charges</li>
        <li>🧾 Add items to your room bill</li>
      </ul>
      <div style="text-align:center;margin:24px 0;">
        <a href="${HOTEL_URL}/guest" style="background:#c8a951;color:#1a2744;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;display:inline-block;">Open Guest Dashboard</a>
      </div>
    `),
  });
}

/**
 * Checkout receipt email
 */
export async function sendCheckoutReceipt(
  to: string,
  guestName: string,
  roomNumber: string | number,
  checkIn: string,
  checkOut: string,
  charges: { description: string; amount: number }[],
  totalCharges: number,
  totalPaid: number,
  balance: number
) {
  const chargeRows = charges.map(c => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#555;">${c.description}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#1a2744;text-align:right;">KES ${c.amount.toLocaleString()}</td>
    </tr>
  `).join('');

  return sendEmail({
    to,
    subject: `Checkout Receipt — ${HOTEL_NAME}`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">Checkout Complete 🧾</h2>
      <p style="color:#555;line-height:1.6;">Hi ${guestName},</p>
      <p style="color:#555;line-height:1.6;">Thank you for staying with us. Here's your folio summary:</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="color:#999;margin:0 0 4px;">Room ${roomNumber} · ${checkIn} → ${checkOut}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
          <thead><tr><td style="padding:8px;border-bottom:2px solid #ddd;color:#999;font-size:12px;">CHARGE</td><td style="padding:8px;border-bottom:2px solid #ddd;color:#999;font-size:12px;text-align:right;">AMOUNT</td></tr></thead>
          <tbody>${chargeRows}</tbody>
          <tfoot>
            <tr><td style="padding:8px;font-weight:bold;color:#1a2744;">Total</td><td style="padding:8px;font-weight:bold;color:#1a2744;text-align:right;">KES ${totalCharges.toLocaleString()}</td></tr>
            <tr><td style="padding:8px;color:#27ae60;">Paid</td><td style="padding:8px;color:#27ae60;text-align:right;">KES ${totalPaid.toLocaleString()}</td></tr>
            ${balance > 0 ? `<tr><td style="padding:8px;color:#e74c3c;font-weight:bold;">Balance Due</td><td style="padding:8px;color:#e74c3c;text-align:right;font-weight:bold;">KES ${balance.toLocaleString()}</td></tr>` : ''}
          </tfoot>
        </table>
      </div>
      ${balance === 0 ? '<p style="color:#27ae60;font-weight:bold;text-align:center;">✅ All charges settled</p>' : ''}
      <p style="color:#555;line-height:1.6;">We hope you enjoyed your stay. Welcome back anytime!</p>
    `),
  });
}

/**
 * Daily operations report email (sent at midnight)
 */
export async function sendDailyReport(to: string, report: {
  date: string;
  totalBookings: number;
  checkIns: number;
  checkOuts: number;
  totalRevenue: number;
  totalPayments: number;
  roomsOccupied: number;
  roomsAvailable: number;
  restaurantOrders: number;
  breakfastOrders: number;
  pendingPayments: number;
}) {
  const occupancyRate = report.roomsOccupied + report.roomsAvailable > 0
    ? Math.round((report.roomsOccupied / (report.roomsOccupied + report.roomsAvailable)) * 100)
    : 0;

  return sendEmail({
    to,
    subject: `Daily Report — ${report.date} — ${HOTEL_NAME}`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">📊 Daily Operations Report</h2>
      <p style="color:#999;margin:0 0 20px;">${report.date}</p>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;">
          <p style="color:#999;font-size:12px;margin:0;">Bookings</p>
          <p style="color:#1a2744;font-size:24px;font-weight:bold;margin:4px 0 0;">${report.totalBookings}</p>
        </div>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;">
          <p style="color:#999;font-size:12px;margin:0;">Check-ins</p>
          <p style="color:#27ae60;font-size:24px;font-weight:bold;margin:4px 0 0;">${report.checkIns}</p>
        </div>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;">
          <p style="color:#999;font-size:12px;margin:0;">Check-outs</p>
          <p style="color:#e67e22;font-size:24px;font-weight:bold;margin:4px 0 0;">${report.checkOuts}</p>
        </div>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;">
          <p style="color:#999;font-size:12px;margin:0;">Occupancy</p>
          <p style="color:#1a2744;font-size:24px;font-weight:bold;margin:4px 0 0;">${occupancyRate}%</p>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">Total Revenue</td><td style="padding:8px;border-bottom:1px solid #eee;color:#1a2744;text-align:right;font-weight:bold;">KES ${report.totalRevenue.toLocaleString()}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">Payments Collected</td><td style="padding:8px;border-bottom:1px solid #eee;color:#27ae60;text-align:right;font-weight:bold;">KES ${report.totalPayments.toLocaleString()}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">Restaurant Orders</td><td style="padding:8px;border-bottom:1px solid #eee;color:#1a2744;text-align:right;">${report.restaurantOrders}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">Breakfast Orders (B&B)</td><td style="padding:8px;border-bottom:1px solid #eee;color:#1a2744;text-align:right;">${report.breakfastOrders}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">Pending Payments</td><td style="padding:8px;border-bottom:1px solid #eee;color:${report.pendingPayments > 0 ? '#e74c3c' : '#27ae60'};text-align:right;font-weight:bold;">${report.pendingPayments}</td></tr>
        <tr><td style="padding:8px;color:#555;">Rooms (Occupied/Available)</td><td style="padding:8px;color:#1a2744;text-align:right;">${report.roomsOccupied} / ${report.roomsAvailable}</td></tr>
      </table>
    `),
  });
}

// ═══════════════════════════════════════════
// SHIFT LIFECYCLE EMAILS
// ═══════════════════════════════════════════

/**
 * Notify staff when a shift is assigned
 */
export async function sendShiftAssignment(to: string, staffName: string, shiftName: string, shiftDate: string, startTime?: string) {
  return sendEmail({
    to,
    subject: `📋 Shift Assigned — ${shiftName} on ${shiftDate}`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">📋 Shift Assigned</h2>
      <p style="color:#555;line-height:1.6;">Hi ${staffName},</p>
      <p style="color:#555;line-height:1.6;">You have been assigned a new shift:</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#999;">Shift</td><td style="padding:8px 0;color:#1a2744;font-weight:bold;">${shiftName.charAt(0).toUpperCase() + shiftName.slice(1)}</td></tr>
          <tr><td style="padding:8px 0;color:#999;">Date</td><td style="padding:8px 0;color:#1a2744;">${shiftDate}</td></tr>
          ${startTime ? `<tr><td style="padding:8px 0;color:#999;">Start Time</td><td style="padding:8px 0;color:#1a2744;">${startTime}</td></tr>` : ''}
        </table>
      </div>
      <p style="color:#555;line-height:1.6;">Please be ready to start your shift on time. Remember to check in when you arrive.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${HOTEL_URL}/staff" style="background:#c8a951;color:#1a2744;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;display:inline-block;">Open Staff Dashboard</a>
      </div>
    `),
  });
}

/**
 * Notify manager/admin when a shift starts (check-in)
 */
export async function sendShiftCheckIn(managerEmails: string[], staffName: string, shiftName: string, checkInTime: string) {
  return sendEmail({
    to: managerEmails,
    subject: `✅ Shift Check-In — ${staffName} (${shiftName})`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">✅ Staff Checked In</h2>
      <div style="background:#e8f5e9;border-radius:8px;padding:16px;margin:16px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#555;">Staff</td><td style="padding:4px 0;color:#1a2744;font-weight:bold;">${staffName}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Shift</td><td style="padding:4px 0;color:#1a2744;">${shiftName}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Check-in Time</td><td style="padding:4px 0;color:#27ae60;font-weight:bold;">${checkInTime}</td></tr>
        </table>
      </div>
    `),
  });
}

/**
 * Notify manager/admin when a shift ends (check-out)
 */
export async function sendShiftCheckOut(managerEmails: string[], staffName: string, shiftName: string, startTime: string, endTime: string) {
  const duration = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 3600000 * 10) / 10;
  return sendEmail({
    to: managerEmails,
    subject: `⏹️ Shift Ended — ${staffName} (${shiftName})`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">⏹️ Shift Ended</h2>
      <div style="background:#fff3e0;border-radius:8px;padding:16px;margin:16px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#555;">Staff</td><td style="padding:4px 0;color:#1a2744;font-weight:bold;">${staffName}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Shift</td><td style="padding:4px 0;color:#1a2744;">${shiftName}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Duration</td><td style="padding:4px 0;color:#1a2744;">${duration} hours</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Status</td><td style="padding:4px 0;color:#e67e22;font-weight:bold;">Pending Reconciliation</td></tr>
        </table>
      </div>
    `),
  });
}

/**
 * Notify manager when reconciliation is submitted
 */
export async function sendReconciliationSubmitted(managerEmails: string[], staffName: string, shiftName: string, data: { salesTotal: number; cashTotal: number; mpesaTotal: number; variance: number; notes?: string }) {
  const hasVariance = Math.abs(data.variance) > 0;
  return sendEmail({
    to: managerEmails,
    subject: `${hasVariance ? '⚠️' : '📊'} Reconciliation Submitted — ${staffName} (${shiftName})`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">📊 Reconciliation Submitted</h2>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#555;">Staff</td><td style="padding:4px 0;color:#1a2744;font-weight:bold;">${staffName}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Shift</td><td style="padding:4px 0;color:#1a2744;">${shiftName}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Sales Total</td><td style="padding:4px 0;color:#1a2744;">KES ${data.salesTotal.toLocaleString()}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Cash Collected</td><td style="padding:4px 0;color:#1a2744;">KES ${data.cashTotal.toLocaleString()}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">M-Pesa</td><td style="padding:4px 0;color:#1a2744;">KES ${data.mpesaTotal.toLocaleString()}</td></tr>
          <tr><td style="padding:4px 0;color:#555;font-weight:bold;">Variance</td><td style="padding:4px 0;color:${hasVariance ? '#e74c3c' : '#27ae60'};font-weight:bold;">${data.variance >= 0 ? '+' : ''}KES ${data.variance.toLocaleString()}</td></tr>
        </table>
      </div>
      ${data.notes ? `<div style="background:#fff3cd;border-radius:8px;padding:12px;margin:12px 0;"><p style="color:#856404;margin:0;font-size:13px;">📝 Notes: ${data.notes}</p></div>` : ''}
      ${hasVariance ? `<div style="background:#fce4ec;border-radius:8px;padding:12px;margin:12px 0;text-align:center;"><p style="color:#c62828;margin:0;font-weight:bold;">⚠️ Variance detected — please review and approve or flag</p></div>` : ''}
      <div style="text-align:center;margin:24px 0;">
        <a href="${HOTEL_URL}/manager/reconciliation" style="background:#c8a951;color:#1a2744;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;display:inline-block;">Review Reconciliation</a>
      </div>
    `),
  });
}

/**
 * Notify staff when their reconciliation is approved or flagged
 */
export async function sendReconciliationResult(to: string, staffName: string, status: 'approved' | 'flagged', managerNotes?: string) {
  const isApproved = status === 'approved';
  return sendEmail({
    to,
    subject: `${isApproved ? '✅' : '⚠️'} Reconciliation ${status.charAt(0).toUpperCase() + status.slice(1)} — ${HOTEL_NAME}`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">${isApproved ? '✅' : '⚠️'} Reconciliation ${status.charAt(0).toUpperCase() + status.slice(1)}</h2>
      <p style="color:#555;line-height:1.6;">Hi ${staffName},</p>
      <p style="color:#555;line-height:1.6;">Your shift reconciliation has been <strong>${status}</strong> by the manager.</p>
      ${managerNotes ? `<div style="background:#f5f5f5;border-radius:8px;padding:12px;margin:16px 0;"><p style="color:#555;margin:0;font-size:13px;">Manager notes: ${managerNotes}</p></div>` : ''}
      <div style="text-align:center;margin:24px 0;">
        <a href="${HOTEL_URL}/staff" style="background:#c8a951;color:#1a2744;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;display:inline-block;">View Dashboard</a>
      </div>
    `),
  });
}

// ═══════════════════════════════════════════
// MIDNIGHT RECONCILIATION AUDIT REPORT
// ═══════════════════════════════════════════

/**
 * Midnight reconciliation audit report email
 * Sent to admin + manager with full reconciliation breakdown
 */
export async function sendReconciliationAuditReport(to: string, report: {
  date: string;
  totalRevenue: number;
  cashCollected: number;
  mpesaCollected: number;
  cardCollected: number;
  totalPayments: number;
  mpesaCodesCount: number;
  shifts: {
    staffName: string;
    role: string;
    shiftName: string;
    salesTotal: number;
    cashTotal: number;
    mpesaTotal: number;
    variance: number;
    varianceStatus: string;
    status: string;
    explanation?: string;
    proofType?: string;
    adminConfirmed: boolean;
  }[];
  unresolvedCount: number;
  resolvedCount: number;
  totalShifts: number;
}) {
  const unresolvedShifts = report.shifts.filter(s => s.varianceStatus === 'open' || s.varianceStatus === 'staff_explained');
  const resolvedShifts = report.shifts.filter(s => s.varianceStatus === 'resolved' || s.varianceStatus === 'none');
  const totalVariance = report.shifts.reduce((sum, s) => sum + s.variance, 0);
  const shortShifts = report.shifts.filter(s => s.variance < 0);
  const overShifts = report.shifts.filter(s => s.variance > 0);

  const shiftRows = report.shifts.map(s => {
    const varianceColor = s.variance < 0 ? '#e74c3c' : s.variance > 0 ? '#e67e22' : '#27ae60';
    const statusBadge = s.status === 'reconciled' ? '✅ Closed' 
      : s.status === 'flagged' ? '🚩 Flagged'
      : s.status === 'explained' ? '💬 Explained'
      : s.status === 'approved' ? '👍 Approved'
      : '⏳ Pending';
    const varianceStatus = s.varianceStatus === 'resolved' ? '✅ Resolved'
      : s.varianceStatus === 'staff_explained' ? '💬 Awaiting Admin'
      : s.varianceStatus === 'open' ? '🔴 Open'
      : '—';
    
    return `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#1a2744;font-weight:bold;">${s.staffName}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#555;text-transform:capitalize;">${s.role}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#1a2744;text-align:right;">KES ${s.salesTotal.toLocaleString()}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#1a2744;text-align:right;">KES ${s.cashTotal.toLocaleString()}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#1a2744;text-align:right;">KES ${s.mpesaTotal.toLocaleString()}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;color:${varianceColor};text-align:right;font-weight:bold;">${s.variance >= 0 ? '+' : ''}KES ${s.variance.toLocaleString()}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">${varianceStatus}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">${statusBadge}</td>
      </tr>
    `;
  }).join('');

  const unresolvedRows = unresolvedShifts.map(s => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#1a2744;">${s.staffName} (${s.role})</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:${s.variance < 0 ? '#e74c3c' : '#e67e22'};font-weight:bold;">${s.variance >= 0 ? '+' : ''}KES ${s.variance.toLocaleString()}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#555;font-size:12px;">${s.varianceStatus === 'staff_explained' ? '💬 Explained — awaiting admin' : '🔴 Open — needs explanation'}</td>
    </tr>
  `).join('');

  return sendEmail({
    to,
    subject: `${report.unresolvedCount > 0 ? '⚠️' : '📊'} Reconciliation Audit — ${report.date} — ${HOTEL_NAME}`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:8px;">📊 Midnight Reconciliation Audit</h2>
      <p style="color:#999;margin:0 0 24px;font-size:14px;">${report.date} · Auto-generated at midnight</p>

      <!-- Summary Cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:24px;">
        <div style="background:#e8f5e9;border-radius:8px;padding:14px;text-align:center;">
          <p style="color:#2e7d32;font-size:11px;margin:0;">Total Revenue</p>
          <p style="color:#1a2744;font-size:20px;font-weight:bold;margin:4px 0 0;">KES ${report.totalRevenue.toLocaleString()}</p>
        </div>
        <div style="background:#e3f2fd;border-radius:8px;padding:14px;text-align:center;">
          <p style="color:#1565c0;font-size:11px;margin:0;">Cash</p>
          <p style="color:#1a2744;font-size:20px;font-weight:bold;margin:4px 0 0;">KES ${report.cashCollected.toLocaleString()}</p>
        </div>
        <div style="background:#e8f5e9;border-radius:8px;padding:14px;text-align:center;">
          <p style="color:#2e7d32;font-size:11px;margin:0;">M-Pesa</p>
          <p style="color:#1a2744;font-size:20px;font-weight:bold;margin:4px 0 0;">KES ${report.mpesaCollected.toLocaleString()}</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:24px;">
        <div style="background:#f5f5f5;border-radius:8px;padding:14px;text-align:center;">
          <p style="color:#999;font-size:11px;margin:0;">Shifts</p>
          <p style="color:#1a2744;font-size:18px;font-weight:bold;margin:4px 0 0;">${report.totalShifts}</p>
        </div>
        <div style="background:#e8f5e9;border-radius:8px;padding:14px;text-align:center;">
          <p style="color:#2e7d32;font-size:11px;margin:0;">Resolved</p>
          <p style="color:#27ae60;font-size:18px;font-weight:bold;margin:4px 0 0;">${report.resolvedCount}</p>
        </div>
        <div style="background:${report.unresolvedCount > 0 ? '#fce4ec' : '#e8f5e9'};border-radius:8px;padding:14px;text-align:center;">
          <p style="color:${report.unresolvedCount > 0 ? '#c62828' : '#2e7d32'};font-size:11px;margin:0;">Unresolved</p>
          <p style="color:${report.unresolvedCount > 0 ? '#c62828' : '#27ae60'};font-size:18px;font-weight:bold;margin:4px 0 0;">${report.unresolvedCount}</p>
        </div>
      </div>

      <!-- Variance Summary -->
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:24px;">
        <h3 style="color:#1a2744;margin:0 0 12px;font-size:14px;">Variance Summary</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:4px 0;color:#555;">Total Variance</td>
            <td style="padding:4px 0;color:${totalVariance < 0 ? '#e74c3c' : '#27ae60'};text-align:right;font-weight:bold;">${totalVariance >= 0 ? '+' : ''}KES ${totalVariance.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#555;">Short Shifts</td>
            <td style="padding:4px 0;color:#e74c3c;text-align:right;">${shortShifts.length} staff</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#555;">Over Shifts</td>
            <td style="padding:4px 0;color:#e67e22;text-align:right;">${overShifts.length} staff</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#555;">M-Pesa Codes Recorded</td>
            <td style="padding:4px 0;color:#1a2744;text-align:right;">${report.mpesaCodesCount}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#555;">Total Payments</td>
            <td style="padding:4px 0;color:#1a2744;text-align:right;">${report.totalPayments}</td>
          </tr>
        </table>
      </div>

      <!-- Full Shift Breakdown -->
      <h3 style="color:#1a2744;margin:0 0 12px;font-size:14px;">Shift Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <td style="padding:8px;color:#999;font-weight:bold;font-size:11px;">STAFF</td>
            <td style="padding:8px;color:#999;font-weight:bold;font-size:11px;">ROLE</td>
            <td style="padding:8px;color:#999;font-weight:bold;font-size:11px;text-align:right;">SALES</td>
            <td style="padding:8px;color:#999;font-weight:bold;font-size:11px;text-align:right;">CASH</td>
            <td style="padding:8px;color:#999;font-weight:bold;font-size:11px;text-align:right;">M-PESA</td>
            <td style="padding:8px;color:#999;font-weight:bold;font-size:11px;text-align:right;">VARIANCE</td>
            <td style="padding:8px;color:#999;font-weight:bold;font-size:11px;text-align:center;">V. STATUS</td>
            <td style="padding:8px;color:#999;font-weight:bold;font-size:11px;text-align:center;">SHIFT</td>
          </tr>
        </thead>
        <tbody>
          ${shiftRows}
        </tbody>
      </table>

      <!-- Unresolved Variances -->
      ${unresolvedShifts.length > 0 ? `
        <div style="background:#fce4ec;border:1px solid #ef9a9a;border-radius:8px;padding:16px;margin-bottom:24px;">
          <h3 style="color:#c62828;margin:0 0 12px;font-size:14px;">⚠️ Unresolved Variances — Action Required</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr>
                <td style="padding:6px 8px;color:#c62828;font-weight:bold;font-size:11px;">STAFF</td>
                <td style="padding:6px 8px;color:#c62828;font-weight:bold;font-size:11px;text-align:right;">VARIANCE</td>
                <td style="padding:6px 8px;color:#c62828;font-weight:bold;font-size:11px;">STATUS</td>
              </tr>
            </thead>
            <tbody>
              ${unresolvedRows}
            </tbody>
          </table>
          <p style="color:#c62828;font-size:12px;margin:12px 0 0;">These variances need to be resolved before the shift can be closed. Log in to review and take action.</p>
        </div>
      ` : `
        <div style="background:#e8f5e9;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
          <p style="color:#2e7d32;margin:0;font-size:14px;">✅ All variances resolved — no action required</p>
        </div>
      `}

      <!-- Action Button -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${HOTEL_URL}/manager/reconciliation" style="background:#c8a951;color:#1a2744;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;display:inline-block;">Review Reconciliation</a>
      </div>
    `),
  });
}

// ═══════════════════════════════════════════
// SHIFT RECONCILIATION SUMMARY → Staff
// ═══════════════════════════════════════════

/**
 * Send full transaction summary to shift owner when reconciliation is approved
 */
export async function sendShiftReconciliationSummary(to: string, staffName: string, data: {
  shiftName: string;
  shiftDate: string;
  salesTotal: number;
  cashTotal: number;
  mpesaTotal: number;
  variance: number;
  payments: { amount: number; method: string; mpesaCode?: string; hasReceipt: boolean; time: string }[];
  orders: { orderNumber: number; guestName: string; total: number; type: string; items: number }[];
  approvedBy: string;
  notes?: string;
}) {
  const paymentRows = data.payments.map(p => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#555;">${p.time}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#1a2744;font-weight:bold;">KES ${p.amount.toLocaleString()}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#555;text-transform:capitalize;">${p.method}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:${p.mpesaCode ? '#2e7d32' : '#999'};font-family:monospace;font-size:12px;">${p.mpesaCode || '—'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${p.hasReceipt ? '✅' : '—'}</td>
    </tr>
  `).join('');

  const orderRows = data.orders.map(o => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#555;">#${o.orderNumber}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#1a2744;">${o.guestName}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#555;">${o.items} items</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#1a2744;font-weight:bold;">KES ${o.total.toLocaleString()}</td>
    </tr>
  `).join('');

  const varianceColor = data.variance < 0 ? '#e74c3c' : data.variance > 0 ? '#e67e22' : '#27ae60';

  return sendEmail({
    to,
    subject: `✅ Shift Reconciliation Approved — ${data.shiftName} (${data.shiftDate})`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:8px;">✅ Shift Reconciliation Approved</h2>
      <p style="color:#999;margin:0 0 24px;font-size:14px;">Hi ${staffName}, your ${data.shiftName} shift has been reconciled.</p>

      <!-- Summary Cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:24px;">
        <div style="background:#e8f5e9;border-radius:8px;padding:14px;text-align:center;">
          <p style="color:#2e7d32;font-size:11px;margin:0;">Total Sales</p>
          <p style="color:#1a2744;font-size:18px;font-weight:bold;margin:4px 0 0;">KES ${data.salesTotal.toLocaleString()}</p>
        </div>
        <div style="background:#e3f2fd;border-radius:8px;padding:14px;text-align:center;">
          <p style="color:#1565c0;font-size:11px;margin:0;">Cash Collected</p>
          <p style="color:#1a2744;font-size:18px;font-weight:bold;margin:4px 0 0;">KES ${data.cashTotal.toLocaleString()}</p>
        </div>
        <div style="background:#e8f5e9;border-radius:8px;padding:14px;text-align:center;">
          <p style="color:#2e7d32;font-size:11px;margin:0;">M-Pesa Collected</p>
          <p style="color:#1a2744;font-size:18px;font-weight:bold;margin:4px 0 0;">KES ${data.mpesaTotal.toLocaleString()}</p>
        </div>
      </div>

      ${data.variance !== 0 ? `
      <div style="background:#fff3cd;border-radius:8px;padding:12px;margin-bottom:20px;text-align:center;">
        <p style="color:#856404;margin:0;font-size:14px;">Variance: <strong style="color:${varianceColor};">${data.variance >= 0 ? '+' : ''}KES ${data.variance.toLocaleString()}</strong> ${data.variance < 0 ? '(short)' : '(over)'}</p>
      </div>
      ` : ''}

      <!-- Payments Table -->
      ${data.payments.length > 0 ? `
      <h3 style="color:#1a2744;margin:0 0 12px;font-size:14px;">💰 Payments (${data.payments.length})</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
        <thead><tr style="background:#f5f5f5;">
          <td style="padding:8px;color:#999;font-size:11px;">TIME</td>
          <td style="padding:8px;color:#999;font-size:11px;">AMOUNT</td>
          <td style="padding:8px;color:#999;font-size:11px;">METHOD</td>
          <td style="padding:8px;color:#999;font-size:11px;">M-PESA CODE</td>
          <td style="padding:8px;color:#999;font-size:11px;text-align:center;">RECEIPT</td>
        </tr></thead>
        <tbody>${paymentRows}</tbody>
      </table>
      ` : ''}

      <!-- Orders Table -->
      ${data.orders.length > 0 ? `
      <h3 style="color:#1a2744;margin:0 0 12px;font-size:14px;">🍽️ Orders (${data.orders.length})</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
        <thead><tr style="background:#f5f5f5;">
          <td style="padding:8px;color:#999;font-size:11px;">ORDER</td>
          <td style="padding:8px;color:#999;font-size:11px;">GUEST</td>
          <td style="padding:8px;color:#999;font-size:11px;">ITEMS</td>
          <td style="padding:8px;color:#999;font-size:11px;">TOTAL</td>
        </tr></thead>
        <tbody>${orderRows}</tbody>
      </table>
      ` : ''}

      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-top:20px;">
        <p style="color:#999;margin:0;font-size:12px;">Approved by ${data.approvedBy} · ${new Date().toLocaleDateString()}</p>
        ${data.notes ? `<p style="color:#555;margin:8px 0 0;font-size:12px;">Notes: ${data.notes}</p>` : ''}
      </div>
    `),
  });
}

// ═══════════════════════════════════════════
// CONFERENCE QUOTE REQUEST → Manager
// ═══════════════════════════════════════════

interface ConferenceQuoteData {
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  companyName?: string;
  roomName: string;
  eventType: string;
  date: string;
  time: string;
  duration: string;
  guestCount: string;
  amenities: string[];
  catering: string[];
  specialRequirements?: string;
}

export async function sendConferenceQuoteRequest(data: ConferenceQuoteData) {
  const managerEmail = 'manager@alerotek.co.ke';
  const eventTypeLabels: Record<string, string> = {
    meeting: 'Business Meeting', workshop: 'Workshop / Training', conference: 'Conference / Seminar',
    corporate_event: 'Corporate Event', product_launch: 'Product Launch', interview: 'Interview Panel',
    celebration: 'Celebration / Party', other: 'Other',
  };

  return sendEmail({
    to: managerEmail,
    subject: `🏢 New Conference Quote Request — ${data.roomName} (${data.date})`,
    replyTo: data.contactEmail,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">🏢 New Conference Quote Request</h2>
      <p style="color:#999;margin:0 0 20px;">Action required — prepare an official quote and reply to the client.</p>
      
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:16px;">
        <h3 style="color:#1a2744;margin:0 0 12px;font-size:16px;">Event Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#555;width:120px;">Contact</td><td style="padding:4px 0;color:#1a2744;font-weight:bold;">${data.contactName}${data.companyName ? ` (${data.companyName})` : ''}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Email</td><td style="padding:4px 0;color:#1a2744;"><a href="mailto:${data.contactEmail}">${data.contactEmail}</a></td></tr>
          ${data.contactPhone ? `<tr><td style="padding:4px 0;color:#555;">Phone</td><td style="padding:4px 0;color:#1a2744;"><a href="tel:${data.contactPhone}">${data.contactPhone}</a></td></tr>` : ''}
          <tr><td style="padding:4px 0;color:#555;">Venue</td><td style="padding:4px 0;color:#1a2744;font-weight:bold;">${data.roomName}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Event Type</td><td style="padding:4px 0;color:#1a2744;">${eventTypeLabels[data.eventType] || data.eventType}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Date</td><td style="padding:4px 0;color:#1a2744;">${data.date}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Time</td><td style="padding:4px 0;color:#1a2744;">${data.time} (${data.duration} hours)</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Guests</td><td style="padding:4px 0;color:#1a2744;">${data.guestCount}</td></tr>
        </table>
      </div>
      
      ${data.amenities.length > 0 ? `
      <div style="background:#fff;border:1px solid #eee;border-radius:8px;padding:16px;margin-bottom:16px;">
        <h3 style="color:#1a2744;margin:0 0 8px;font-size:14px;">AV & Equipment</h3>
        <p style="color:#555;margin:0;">${data.amenities.join(', ')}</p>
      </div>` : ''}
      
      ${data.catering.length > 0 ? `
      <div style="background:#fff;border:1px solid #eee;border-radius:8px;padding:16px;margin-bottom:16px;">
        <h3 style="color:#1a2744;margin:0 0 8px;font-size:14px;">Catering</h3>
        <p style="color:#555;margin:0;">${data.catering.join(', ')}</p>
      </div>` : ''}
      
      ${data.specialRequirements ? `
      <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:16px;margin-bottom:16px;">
        <h3 style="color:#856404;margin:0 0 8px;font-size:14px;">⚠️ Special Requirements</h3>
        <p style="color:#856404;margin:0;">${data.specialRequirements}</p>
      </div>` : ''}
      
      <div style="background:#e8f5e9;border-radius:8px;padding:16px;text-align:center;">
        <p style="color:#2e7d32;margin:0;font-size:14px;">📋 <strong>Next Step:</strong> Prepare an official quote and reply to ${data.contactEmail}</p>
      </div>
    `),
  });
}

// ═══════════════════════════════════════════
// CONFERENCE CONFIRMATION → Guest
// ═══════════════════════════════════════════

export async function sendConferenceConfirmation(to: string, data: {
  guestName: string;
  roomName: string;
  date: string;
  time: string;
  duration: string;
}) {
  return sendEmail({
    to,
    subject: `✅ Conference Request Received — Keyman Hotel`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">✅ Request Received!</h2>
      <p style="color:#555;margin:0 0 20px;">Dear ${data.guestName},</p>
      <p style="color:#555;margin:0 0 20px;">Thank you for your conference request at Keyman Hotel. Here's a summary:</p>
      
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#555;width:100px;">Venue</td><td style="padding:4px 0;color:#1a2744;font-weight:bold;">${data.roomName}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Date</td><td style="padding:4px 0;color:#1a2744;">${data.date}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">Time</td><td style="padding:4px 0;color:#1a2744;">${data.time} (${data.duration}h)</td></tr>
        </table>
      </div>
      
      <p style="color:#555;margin:0 0 12px;">Our events team is preparing your quote. You'll receive an official proposal within <strong>24 hours</strong>.</p>
      <p style="color:#999;margin:0;">If you have any questions, reply to this email or call us.</p>
    `),
  });
}
