// ═══════════════════════════════════════════════════════════════
// Business Deck Email Delivery — Edge Function
// Generates deck summary + sends email to all admins & managers
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Get today's date
    const today = new Date().toISOString().split("T")[0];
    const dateLabel = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    console.log(`Generating Business Deck for ${today}...`);

    // ─── 1. Fetch all deck data ───
    const [execRev, revRev, occRev, kitRev, stfRev, gstRev, payRev, insRev, frcRev] = await Promise.all([
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
    const kit = kitRev.data as any;
    const gst = gstRev.data as any;
    const pay = payRev.data as any;
    const ins = insRev.data as any;
    const frc = frcRev.data as any;

    // ─── 2. Build email HTML ───
    const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;
    const pct = (n: number) => `${Number(n || 0).toFixed(1)}%`;

    const insightsHtml = ins?.insights?.map((i: any) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          <strong style="color:${i.type === 'green' ? '#16a34a' : i.type === 'red' ? '#dc2626' : i.type === 'amber' ? '#f59e0b' : '#2563eb'};">${i.title}</strong><br>
          <span style="font-size:14px;">${i.value}</span><br>
          <span style="font-size:12px;color:#666;">${i.description}</span>
          ${i.projected_uplift ? `<br><span style="font-size:12px;color:#16a34a;font-weight:600;">📈 ${i.projected_uplift}</span>` : ''}
        </td>
      </tr>
    `).join('') || '<tr><td style="padding:8px;color:#666;">No insights today — all metrics within normal range.</td></tr>';

    const forecastHtml = frc?.map((f: any) => `
      <td style="text-align:center;padding:8px;background:${f.occupancy_pct > 80 ? '#dcfce7' : f.occupancy_pct > 50 ? '#fef3c7' : '#fee2e2'};border-radius:6px;">
        <div style="font-weight:600;">${f.day_name}</div>
        <div style="font-size:20px;font-weight:800;">${f.occupancy_pct}%</div>
        <div style="font-size:10px;color:#666;">${f.booked}/${occ?.total_rooms || 21}</div>
      </td>
    `).join('') || '<td style="padding:8px;color:#666;">No forecast data</td>';

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:system-ui,-apple-system,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#1a1a2e;">
      
      <!-- Header -->
      <div style="background:#1a1a2e;color:white;padding:30px;border-radius:12px;margin-bottom:24px;">
        <div style="color:#c8a951;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Business Intelligence Report</div>
        <h1 style="margin:4px 0 0;font-size:24px;">🏨 Keyman Hotel</h1>
        <div style="font-size:13px;opacity:0.7;margin-top:4px;">${dateLabel}</div>
      </div>

      <!-- KPIs -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="text-align:center;padding:12px;background:#f8f6f0;border-radius:8px;width:25%;">
            <div style="font-size:24px;font-weight:800;">${pct(ex?.occupancy_pct)}</div>
            <div style="font-size:10px;color:#666;text-transform:uppercase;">Occupancy</div>
          </td>
          <td style="width:4%"></td>
          <td style="text-align:center;padding:12px;background:#f8f6f0;border-radius:8px;width:25%;">
            <div style="font-size:24px;font-weight:800;">${fmt(ex?.total_revenue)}</div>
            <div style="font-size:10px;color:#666;text-transform:uppercase;">Total Revenue</div>
          </td>
          <td style="width:4%"></td>
          <td style="text-align:center;padding:12px;background:#f8f6f0;border-radius:8px;width:25%;">
            <div style="font-size:24px;font-weight:800;">${fmt(ex?.avg_daily_rate)}</div>
            <div style="font-size:10px;color:#666;text-transform:uppercase;">ADR</div>
          </td>
          <td style="width:4%"></td>
          <td style="text-align:center;padding:12px;background:#f8f6f0;border-radius:8px;width:25%;">
            <div style="font-size:24px;font-weight:800;">${fmt(ex?.revpar)}</div>
            <div style="font-size:10px;color:#666;text-transform:uppercase;">RevPAR</div>
          </td>
        </tr>
      </table>

      <!-- Revenue -->
      <h2 style="font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">💰 Revenue</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
        <tr style="background:#f8f6f0;">
          <th style="text-align:left;padding:8px;">Category</th>
          <th style="text-align:right;padding:8px;">Today</th>
          <th style="text-align:right;padding:8px;">Yesterday</th>
          <th style="text-align:right;padding:8px;">This Week</th>
        </tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">🛏️ Room Revenue</td><td style="text-align:right;padding:8px;font-weight:600;">${fmt(rev?.today?.room_revenue)}</td><td style="text-align:right;padding:8px;color:#666;">${fmt(rev?.yesterday?.room_revenue)}</td><td style="text-align:right;padding:8px;">${fmt(rev?.week?.room_revenue)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">🍽️ Restaurant Revenue</td><td style="text-align:right;padding:8px;font-weight:600;">${fmt(rev?.today?.restaurant_revenue)}</td><td style="text-align:right;padding:8px;color:#666;">${fmt(rev?.yesterday?.restaurant_revenue)}</td><td style="text-align:right;padding:8px;">${fmt(rev?.week?.restaurant_revenue)}</td></tr>
        <tr style="font-weight:700;background:#f8f6f0;"><td style="padding:8px;">TOTAL</td><td style="text-align:right;padding:8px;">${fmt(rev?.today?.total)}</td><td style="text-align:right;padding:8px;">${fmt(rev?.yesterday?.total)}</td><td style="text-align:right;padding:8px;">${fmt(rev?.week?.total)}</td></tr>
      </table>

      <!-- Occupancy -->
      <h2 style="font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">🛏️ Occupancy</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
        <tr style="background:#f8f6f0;">
          <th style="text-align:left;padding:8px;">Room Type</th>
          <th style="text-align:right;padding:8px;">Total</th>
          <th style="text-align:right;padding:8px;">Occupied</th>
          <th style="text-align:right;padding:8px;">Occupancy</th>
          <th style="text-align:right;padding:8px;">ADR</th>
        </tr>
        ${occ?.by_type?.map((rt: any) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${rt.name}</td>
            <td style="text-align:right;padding:8px;">${rt.total}</td>
            <td style="text-align:right;padding:8px;">${rt.occupied}</td>
            <td style="text-align:right;padding:8px;">${pct(rt.occupancy_pct)}</td>
            <td style="text-align:right;padding:8px;">${fmt(rt.adr)}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" style="padding:8px;color:#666;">No room type data</td></tr>'}
      </table>

      <!-- Forecast -->
      <h2 style="font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">🔮 7-Day Forecast</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>${forecastHtml}</tr>
      </table>

      <!-- Insights -->
      <h2 style="font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">💡 Business Insights</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${insightsHtml}
      </table>

      <!-- CTA -->
      <div style="text-align:center;padding:20px;background:#f8f6f0;border-radius:12px;margin-bottom:20px;">
        <a href="https://keymanhotel.alerotek.co.ke/admin/business-deck" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#c8a951;text-decoration:none;border-radius:8px;font-weight:600;">
          📊 View Full Business Deck →
        </a>
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding:16px;font-size:11px;color:#999;border-top:1px solid #eee;">
        <p><strong>Keyman Hotel</strong> — Business Intelligence Deck</p>
        <p>Generated by Keyman PMS • Mwatate, Taita Taveta</p>
        <p style="font-style:italic;margin-top:8px;">This report contains confidential business data.</p>
      </div>

    </body>
    </html>
    `;

    // ─── 3. Get admin & manager emails ───
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
    console.log(`Sending to: ${emails.join(", ")}`);

    // ─── 4. Send email via Resend (if configured) ───
    if (resendApiKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Keyman Hotel <deck@alerotek.co.ke>",
          to: emails,
          subject: `📊 Business Deck — ${dateLabel}`,
          html: emailHtml,
        }),
      });

      const emailResult = await emailResponse.json();
      console.log("Email sent:", emailResult);
    } else {
      console.log("RESEND_API_KEY not configured. Email preview saved.");
      // Store the email HTML for preview
      await supabase.from("site_settings").upsert(
        { key: `business_deck_email_${today}`, value: emailHtml },
        { onConflict: "key" }
      );
    }

    // ─── 5. Log the deck generation ───
    await supabase.from("site_settings").upsert(
      {
        key: `business_deck_generated_${today}`,
        value: JSON.stringify({
          generated_at: new Date().toISOString(),
          recipients: emails,
          occupancy: ex?.occupancy_pct,
          revenue: ex?.total_revenue,
          insights_count: ins?.insights?.length || 0,
        }),
      },
      { onConflict: "key" }
    );

    return new Response(
      JSON.stringify({
        status: "success",
        date: today,
        recipients: emails.length,
        occupancy: ex?.occupancy_pct,
        revenue: ex?.total_revenue,
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
