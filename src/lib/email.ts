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
  return sendEmail({
    to,
    subject: `Welcome to ${HOTEL_NAME} — Your Account is Ready`,
    html: baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">Welcome, ${userName}! 👋</h2>
      <p style="color:#555;line-height:1.6;">Your <strong>${role}</strong> account has been created on the ${HOTEL_NAME} management system.</p>
      ${temporaryPassword ? `
        <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:20px 0;">
          <p style="color:#555;margin:0 0 8px;">Your login credentials:</p>
          <p style="color:#555;margin:0;"><strong>Email:</strong> ${to}</p>
          <p style="color:#555;margin:8px 0 0;"><strong>Password:</strong> <code style="background:#e8e8e8;padding:2px 6px;border-radius:4px;">${temporaryPassword}</code></p>
        </div>
        <p style="color:#e74c3c;font-size:13px;">⚠️ Please change your password after first login.</p>
      ` : ''}
      <div style="text-align:center;margin:24px 0;">
        <a href="${HOTEL_URL}/login" style="background:#c8a951;color:#1a2744;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;display:inline-block;">Login to Dashboard</a>
      </div>
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
