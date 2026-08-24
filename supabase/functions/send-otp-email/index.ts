// Supabase Edge Function: send-otp-email
// Sends OTP codes via Resend API from the server side (no CORS issues)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = "Keyman Hotel <nonreply@alerotek.co.ke>";
const HOTEL_NAME = "Keyman Hotel";

interface OTPRequest {
  email: string;
  code: string;
  purpose: "guest_signup" | "password_reset" | "staff_invite";
  userName?: string;
  role?: string;
}

function baseTemplate(content: string): string {
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
            ${HOTEL_NAME} · Mwatate, Kenya
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getSubject(purpose: string): string {
  switch (purpose) {
    case "guest_signup":
      return `Your Verification Code — ${HOTEL_NAME}`;
    case "password_reset":
      return `Your Password Reset Code — ${HOTEL_NAME}`;
    case "staff_invite":
      return `Welcome to ${HOTEL_NAME} — Your Account is Ready`;
    default:
      return `Your Code — ${HOTEL_NAME}`;
  }
}

function getEmailContent(req: OTPRequest): string {
  const { code, purpose, userName, role } = req;

  if (purpose === "guest_signup") {
    return baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">Welcome!</h2>
      <p style="color:#555;line-height:1.6;">Use the code below to verify your email and access your guest dashboard:</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a2744;margin:0;">${code}</p>
        <p style="color:#999;font-size:12px;margin-top:8px;">Expires in 10 minutes</p>
      </div>
      <p style="color:#555;line-height:1.6;">If you didn't request this, please ignore this email.</p>
    `);
  }

  if (purpose === "password_reset") {
    return baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">Password Reset</h2>
      <p style="color:#555;line-height:1.6;">We received a request to reset your password. Use the code below:</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a2744;margin:0;">${code}</p>
        <p style="color:#999;font-size:12px;margin-top:8px;">Expires in 10 minutes</p>
      </div>
      <p style="color:#e74c3c;font-size:12px;line-height:1.6;">If you didn't request this, please ignore this email. Do not share this code with anyone.</p>
    `);
  }

  if (purpose === "staff_invite") {
    const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1).replace("_", " ") : "Staff";
    return baseTemplate(`
      <h2 style="color:#1a2744;margin-bottom:16px;">Welcome, ${userName || "there"}! 👋</h2>
      <p style="color:#555;line-height:1.6;">Your <strong>${roleLabel}</strong> account has been created. Use the code below to set your password:</p>
      <div style="background:#e8f5e9;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
        <p style="color:#2e7d32;margin:0;font-size:14px;">🎯 Your Role: <strong>${roleLabel}</strong></p>
      </div>
      <div style="background:#f5f5f5;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a2744;margin:0;">${code}</p>
        <p style="color:#999;font-size:12px;margin-top:8px;">Expires in 10 minutes</p>
      </div>
      <p style="color:#e74c3c;font-size:12px;line-height:1.6;">If you didn't expect this email, please ignore it. Do not share this code with anyone.</p>
    `);
  }

  return baseTemplate(`<p>Code: ${code}</p>`);
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const reqBody: OTPRequest = await req.json();
    const { email, code, purpose, userName, role } = reqBody;

    if (!email || !code || !purpose) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: email, code, purpose" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Send email via Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: getSubject(purpose),
        html: getEmailContent(reqBody),
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return new Response(
        JSON.stringify({ success: true, id: data.id }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } else {
      console.error("[send-otp-email] Resend error:", data);
      return new Response(
        JSON.stringify({ success: false, error: data.message || "Email send failed" }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  } catch (err) {
    console.error("[send-otp-email] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
