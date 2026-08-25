// ═══════════════════════════════════════════════════════════════
// Business Deck Email Delivery — Edge Function
// Generates deck summary + sends mobile-friendly tracked email
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get today's date in EAT (UTC+3)
    const now = new Date();
    const eatOffset = 3 * 60 * 60 * 1000;
    const eatDate = new Date(now.getTime() + eatOffset);
    const today = eatDate.toISOString().split("T")[0];
    const dateLabel = eatDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Africa/Nairobi",
    });

    console.log(`Generating Business Deck for ${today}...`);

    // ─── 1. Fetch all deck data ───
    const [execRev, revRev, occRev, kitRev, stfRev, gstRev, payRev, insRev, frcRev] =
      await Promise.all([
        supabase.rpc("get_business_deck_executive", { p_date: today }),
        supabase.rpc("get_business_deck_revenue", { p_date: today }),
        supabase.rpc("get_business_deck_occupancy", { p_date: today }),
        supabase.rpc("get_business_deck_kitchen", { p_date: today }),
        supabase.rpc("get_business_deck_staff", { p_date: today }),
        supabase.rpc("get_business_deck_guests", { p_date: today }),
        supabase.rpc("get_business_deck_payments", { p_date: today }),
        supabase.rpc("get_business_insights", { p_date: today }),
        supabase.rpc("get_business_deck_forecast", { p_date: today }),
      ]);

    const ex = execRev.data as any;
    const rev = revRev.data as any;
    const occ = occRev.data as any;
    const ins = insRev.data as any;
    const frc = frcRev.data as any;

    // ─── 2. Helpers ───
    const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;
    const pct = (n: number) => `${Number(n || 0).toFixed(1)}%`;

    // ─── 3. Build mobile-friendly email HTML ───
    const insightsHtml =
      ins?.insights
        ?.map(
          (i: any) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="6" style="background:${
              i.type === "green"
                ? "#16a34a"
                : i.type === "red"
                ? "#dc2626"
                : i.type === "amber"
                ? "#f59e0b"
                : "#2563eb"
            };border-radius:3px;"></td>
            <td style="padding-left:12px;">
              <div style="font-size:15px;font-weight:700;color:#1a1a2e;">${i.title}</div>
              <div style="font-size:13px;color:#555;margin-top:2px;">${i.value}</div>
              <div style="font-size:12px;color:#888;margin-top:2px;">${i.description}</div>
              ${
                i.projected_uplift
                  ? `<div style="font-size:12px;color:#16a34a;font-weight:600;margin-top:4px;">📈 ${i.projected_uplift}</div>`
                  : ""
              }
            </td>
          </tr></table>
        </td>
      </tr>`
        )
        .join("") ||
      '<tr><td style="padding:10px 0;color:#888;font-size:13px;">No insights today — all metrics within normal range.</td></tr>';

    // Forecast: 2-3 per row on mobile
    const forecastHtml =
      frc
        ?.map(
          (f: any) => `
      <td style="text-align:center;padding:6px 4px;background:${
        f.occupancy_pct > 80
          ? "#dcfce7"
          : f.occupancy_pct > 50
          ? "#fef3c7"
          : "#fee2e2"
      };border-radius:8px;width:13%;">
        <div style="font-size:12px;font-weight:700;color:#333;">${f.day_name}</div>
        <div style="font-size:20px;font-weight:800;color:#1a1a2e;">${f.occupancy_pct}%</div>
        <div style="font-size:10px;color:#888;">${f.booked}/${occ?.total_rooms || 21}</div>
      </td>`
        )
        .join("") ||
      '<td style="padding:10px;color:#888;">No forecast data</td>';

    const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Keyman Hotel Business Deck</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td { font-family: Arial, sans-serif !important; }
      </style>
      <![endif]-->
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a2e;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

      <!-- Wrapper Table -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;">
        <tr>
          <td align="center" style="padding:16px 8px;">

            <!-- Main Container -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">

              <!-- ═══ HEADER ═══ -->
              <tr>
                <td style="background:#1a1a2e;padding:28px 24px;text-align:center;">
                  <div style="color:#c8a951;font-size:11px;text-transform:uppercase;letter-spacing:3px;font-weight:600;">Business Intelligence Report</div>
                  <h1 style="margin:8px 0 0;font-size:26px;color:#ffffff;font-weight:800;">🏨 Keyman Hotel</h1>
                  <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:6px;">${dateLabel}</div>
                </td>
              </tr>

              <!-- ═══ KPIs — 2×2 Grid ═══ -->
              <tr>
                <td style="padding:20px 16px 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="48%" style="background:#f8f6f0;border-radius:10px;padding:16px 12px;text-align:center;">
                        <div style="font-size:28px;font-weight:800;color:#1a1a2e;">${pct(ex?.occupancy_pct)}</div>
                        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Occupancy</div>
                      </td>
                      <td width="4%"></td>
                      <td width="48%" style="background:#f8f6f0;border-radius:10px;padding:16px 12px;text-align:center;">
                        <div style="font-size:28px;font-weight:800;color:#1a1a2e;">${fmt(ex?.total_revenue)}</div>
                        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Total Revenue</div>
                      </td>
                    </tr>
                    <tr><td colspan="3" height="8"></td></tr>
                    <tr>
                      <td width="48%" style="background:#f8f6f0;border-radius:10px;padding:16px 12px;text-align:center;">
                        <div style="font-size:28px;font-weight:800;color:#1a1a2e;">${fmt(ex?.avg_daily_rate)}</div>
                        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">ADR</div>
                      </td>
                      <td width="4%"></td>
                      <td width="48%" style="background:#f8f6f0;border-radius:10px;padding:16px 12px;text-align:center;">
                        <div style="font-size:28px;font-weight:800;color:#1a1a2e;">${fmt(ex?.revpar)}</div>
                        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">RevPAR</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ═══ REVENUE ═══ -->
              <tr>
                <td style="padding:20px 16px 0;">
                  <h2 style="font-size:16px;margin:0 0 10px;color:#1a1a2e;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">💰 Revenue</h2>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;">
                    <tr style="background:#f8f6f0;">
                      <th style="text-align:left;padding:10px 8px;font-size:12px;color:#666;">Category</th>
                      <th style="text-align:right;padding:10px 8px;font-size:12px;color:#666;">Today</th>
                      <th style="text-align:right;padding:10px 8px;font-size:12px;color:#666;">Yesterday</th>
                      <th style="text-align:right;padding:10px 8px;font-size:12px;color:#666;">Week</th>
                    </tr>
                    <tr>
                      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;">🛏️ Room</td>
                      <td style="text-align:right;padding:10px 8px;font-weight:600;border-bottom:1px solid #f0f0f0;">${fmt(rev?.today?.room_revenue)}</td>
                      <td style="text-align:right;padding:10px 8px;color:#888;border-bottom:1px solid #f0f0f0;">${fmt(rev?.yesterday?.room_revenue)}</td>
                      <td style="text-align:right;padding:10px 8px;border-bottom:1px solid #f0f0f0;">${fmt(rev?.week?.room_revenue)}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;">🍽️ Restaurant</td>
                      <td style="text-align:right;padding:10px 8px;font-weight:600;border-bottom:1px solid #f0f0f0;">${fmt(rev?.today?.restaurant_revenue)}</td>
                      <td style="text-align:right;padding:10px 8px;color:#888;border-bottom:1px solid #f0f0f0;">${fmt(rev?.yesterday?.restaurant_revenue)}</td>
                      <td style="text-align:right;padding:10px 8px;border-bottom:1px solid #f0f0f0;">${fmt(rev?.week?.restaurant_revenue)}</td>
                    </tr>
                    <tr style="background:#f8f6f0;">
                      <td style="padding:10px 8px;font-weight:700;">TOTAL</td>
                      <td style="text-align:right;padding:10px 8px;font-weight:700;">${fmt(rev?.today?.total)}</td>
                      <td style="text-align:right;padding:10px 8px;color:#888;">${fmt(rev?.yesterday?.total)}</td>
                      <td style="text-align:right;padding:10px 8px;font-weight:700;">${fmt(rev?.week?.total)}</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ═══ OCCUPANCY ═══ -->
              <tr>
                <td style="padding:20px 16px 0;">
                  <h2 style="font-size:16px;margin:0 0 10px;color:#1a1a2e;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">🛏️ Occupancy</h2>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;">
                    <tr style="background:#f8f6f0;">
                      <th style="text-align:left;padding:10px 8px;font-size:12px;color:#666;">Room Type</th>
                      <th style="text-align:right;padding:10px 8px;font-size:12px;color:#666;">Total</th>
                      <th style="text-align:right;padding:10px 8px;font-size:12px;color:#666;">Occupied</th>
                      <th style="text-align:right;padding:10px 8px;font-size:12px;color:#666;">%</th>
                      <th style="text-align:right;padding:10px 8px;font-size:12px;color:#666;">ADR</th>
                    </tr>
                    ${
                      occ?.by_type
                        ?.map(
                          (rt: any) => `
                    <tr>
                      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;">${rt.name}</td>
                      <td style="text-align:right;padding:10px 8px;border-bottom:1px solid #f0f0f0;">${rt.total}</td>
                      <td style="text-align:right;padding:10px 8px;border-bottom:1px solid #f0f0f0;">${rt.occupied}</td>
                      <td style="text-align:right;padding:10px 8px;border-bottom:1px solid #f0f0f0;font-weight:600;color:${
                        rt.occupancy_pct > 80 ? "#16a34a" : rt.occupancy_pct > 50 ? "#f59e0b" : "#dc2626"
                      };">${pct(rt.occupancy_pct)}</td>
                      <td style="text-align:right;padding:10px 8px;border-bottom:1px solid #f0f0f0;">${fmt(rt.adr)}</td>
                    </tr>`
                        )
                        .join("") ||
                      '<tr><td colspan="5" style="padding:10px 8px;color:#888;">No room type data</td></tr>'
                    }
                  </table>
                </td>
              </tr>

              <!-- ═══ 7-DAY FORECAST ═══ -->
              <tr>
                <td style="padding:20px 16px 0;">
                  <h2 style="font-size:16px;margin:0 0 10px;color:#1a1a2e;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">🔮 7-Day Forecast</h2>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>${forecastHtml}</tr>
                  </table>
                </td>
              </tr>

              <!-- ═══ INSIGHTS ═══ -->
              <tr>
                <td style="padding:20px 16px 0;">
                  <h2 style="font-size:16px;margin:0 0 10px;color:#1a1a2e;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">💡 Business Insights</h2>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${insightsHtml}
                  </table>
                </td>
              </tr>

              <!-- ═══ CTA BUTTON ═══ -->
              <tr>
                <td style="padding:24px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background:#f8f6f0;border-radius:12px;padding:20px;text-align:center;">
                        <p style="margin:0 0 12px;font-size:14px;color:#555;">View the complete dashboard with charts, trends, and detailed breakdowns</p>
                        <a href="https://keymanhotel.alerotek.co.ke/admin/business-deck" style="display:inline-block;padding:14px 32px;background:#1a1a2e;color:#c8a951;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:0.5px;">
                          📊 View Full Business Deck
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ═══ FOOTER ═══ -->
              <tr>
                <td style="background:#f8f6f0;padding:20px 16px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;font-size:13px;color:#555;font-weight:600;">Keyman Hotel</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#999;">Business Intelligence Deck • Mwatate, Taita Taveta</p>
                  <p style="margin:8px 0 0;font-size:10px;color:#bbb;font-style:italic;">This report contains confidential business data. Do not forward.</p>
                  <p style="margin:12px 0 0;font-size:10px;color:#ccc;">Powered by Keyman PMS</p>
                </td>
              </tr>

            </table>
            <!-- End Main Container -->

          </td>
        </tr>
      </table>
      <!-- End Wrapper -->

    </body>
    </html>
    `;

    // ─── 4. Get admin & manager emails ───
    const { data: recipients } = await supabase
      .from("users")
      .select("email, full_name")
      .in("role", ["admin", "manager"])
      .eq("is_active", true);

    if (!recipients || recipients.length === 0) {
      console.log("No active admin/manager users found. Skipping email.");
      return new Response(JSON.stringify({ status: "no_recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emails = recipients.map((r: any) => r.email).filter(Boolean);
    console.log(`Sending to ${emails.length} recipients: ${emails.join(", ")}`);

    // ─── 5. Send email via Resend with tracking ───
    let emailResult: any = null;

    if (resendApiKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Keyman Hotel <deck@alerotek.co.ke>",
          to: emails,
          subject: `📊 Business Deck — ${dateLabel}`,
          html: emailHtml,
          // Resend email tracking: open + click
          tracking: {
            open: true,
            click: true,
          },
          // Tags for filtering in Resend dashboard
          tags: [
            { name: "category", value: "business-deck" },
            { name: "date", value: today },
          ],
        }),
      });

      emailResult = await emailResponse.json();

      if (emailResponse.ok) {
        console.log(`✅ Email sent successfully. ID: ${emailResult?.id}`);
      } else {
        console.error(`❌ Email failed (${emailResponse.status}):`, emailResult);
      }
    } else {
      console.log("RESEND_API_KEY not configured. Skipping email send.");
    }

    // ─── 6. Log deck generation ───
    try {
      await supabase.from("site_settings").upsert(
        {
          key: `business_deck_generated_${today}`,
          value: JSON.stringify({
            generated_at: new Date().toISOString(),
            recipients: emails,
            occupancy: ex?.occupancy_pct,
            revenue: ex?.total_revenue,
            email_id: emailResult?.id || null,
            email_status: emailResult?.id ? "sent" : "not_sent",
            insights_count: ins?.insights?.length || 0,
            tracking_enabled: true,
          }),
        },
        { onConflict: "key" }
      );
    } catch (e) {
      console.log("Could not store log (RLS):", (e as Error).message);
    }

    return new Response(
      JSON.stringify({
        status: emailResult?.id ? "success" : "partial",
        date: today,
        recipients: emails.length,
        occupancy: ex?.occupancy_pct,
        revenue: ex?.total_revenue,
        email_id: emailResult?.id || null,
        tracking: { open: true, click: true },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ status: "error", error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
