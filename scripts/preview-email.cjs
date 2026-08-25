const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://uuojiyehhnhjcakgpsjd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1b2ppeWVoaG5oamNha2dwc2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMDY5ODIsImV4cCI6MjEwMjg4Mjk4Mn0.hjyllyGAMp3HxU3hTtyj1Lpqh8oOwedO1cW5VRNDkPI'
);

async function preview() {
  const today = new Date().toISOString().split('T')[0];
  
  // Fetch all data
  const [execRev, revRev, occRev, insRev, frcRev] = await Promise.all([
    supabase.rpc('get_business_deck_executive', { p_date: today }),
    supabase.rpc('get_business_deck_revenue', { p_date: today }),
    supabase.rpc('get_business_deck_occupancy', { p_date: today }),
    supabase.rpc('get_business_insights', { p_date: today }),
    supabase.rpc('get_business_deck_forecast', { p_date: today }),
  ]);

  const ex = execRev.data;
  const rev = revRev.data;
  const occ = occRev.data;
  const ins = insRev.data;
  const frc = frcRev.data;
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`;
  const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

  const insightsHtml = ins?.insights?.map(i => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #eee;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="6" style="background:${i.type === 'green' ? '#16a34a' : i.type === 'red' ? '#dc2626' : i.type === 'amber' ? '#f59e0b' : '#2563eb'};border-radius:3px;"></td>
        <td style="padding-left:12px;">
          <div style="font-size:15px;font-weight:700;color:#1a1a2e;">${i.title}</div>
          <div style="font-size:13px;color:#555;margin-top:2px;">${i.value}</div>
          <div style="font-size:12px;color:#888;margin-top:2px;">${i.description}</div>
          ${i.projected_uplift ? `<div style="font-size:12px;color:#16a34a;font-weight:600;margin-top:4px;">📈 ${i.projected_uplift}</div>` : ''}
        </td>
      </tr></table>
    </td></tr>`).join('') || '<tr><td style="padding:10px;color:#888;">No insights today.</td></tr>';

  const forecastHtml = frc?.map(f => `
    <td style="text-align:center;padding:6px 4px;background:${f.occupancy_pct > 80 ? '#dcfce7' : f.occupancy_pct > 50 ? '#fef3c7' : '#fee2e2'};border-radius:8px;width:13%;">
      <div style="font-size:12px;font-weight:700;color:#333;">${f.day_name}</div>
      <div style="font-size:20px;font-weight:800;color:#1a1a2e;">${f.occupancy_pct}%</div>
      <div style="font-size:10px;color:#888;">${f.booked}/${occ?.total_rooms || 21}</div>
    </td>`).join('') || '<td style="padding:10px;color:#888;">No forecast data</td>';

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a2e;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;"><tr><td align="center" style="padding:16px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:28px 24px;text-align:center;">
    <div style="color:#c8a951;font-size:11px;text-transform:uppercase;letter-spacing:3px;font-weight:600;">Business Intelligence Report</div>
    <h1 style="margin:8px 0 0;font-size:26px;color:#fff;font-weight:800;">🏨 Keyman Hotel</h1>
    <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:6px;">${dateLabel}</div>
  </td></tr>
  <tr><td style="padding:20px 16px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="48%" style="background:#f8f6f0;border-radius:10px;padding:16px 12px;text-align:center;"><div style="font-size:28px;font-weight:800;color:#1a1a2e;">${pct(ex?.occupancy_pct)}</div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Occupancy</div></td>
        <td width="4%"></td>
        <td width="48%" style="background:#f8f6f0;border-radius:10px;padding:16px 12px;text-align:center;"><div style="font-size:28px;font-weight:800;color:#1a1a2e;">${fmt(ex?.total_revenue)}</div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Revenue</div></td>
      </tr>
      <tr><td colspan="3" height="8"></td></tr>
      <tr>
        <td width="48%" style="background:#f8f6f0;border-radius:10px;padding:16px 12px;text-align:center;"><div style="font-size:28px;font-weight:800;color:#1a1a2e;">${fmt(ex?.avg_daily_rate)}</div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">ADR</div></td>
        <td width="4%"></td>
        <td width="48%" style="background:#f8f6f0;border-radius:10px;padding:16px 12px;text-align:center;"><div style="font-size:28px;font-weight:800;color:#1a1a2e;">${fmt(ex?.revpar)}</div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">RevPAR</div></td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 16px 0;">
    <h2 style="font-size:16px;margin:0 0 10px;color:#1a1a2e;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">💰 Revenue</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;">
      <tr style="background:#f8f6f0;"><th style="text-align:left;padding:10px 8px;font-size:12px;color:#666;">Category</th><th style="text-align:right;padding:10px 8px;font-size:12px;color:#666;">Today</th><th style="text-align:right;padding:10px 8px;font-size:12px;color:#666;">Yesterday</th><th style="text-align:right;padding:10px 8px;font-size:12px;color:#666;">Week</th></tr>
      <tr><td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;">🛏️ Room</td><td style="text-align:right;padding:10px 8px;font-weight:600;border-bottom:1px solid #f0f0f0;">${fmt(rev?.today?.room_revenue)}</td><td style="text-align:right;padding:10px 8px;color:#888;border-bottom:1px solid #f0f0f0;">${fmt(rev?.yesterday?.room_revenue)}</td><td style="text-align:right;padding:10px 8px;border-bottom:1px solid #f0f0f0;">${fmt(rev?.week?.room_revenue)}</td></tr>
      <tr><td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;">🍽️ Restaurant</td><td style="text-align:right;padding:10px 8px;font-weight:600;border-bottom:1px solid #f0f0f0;">${fmt(rev?.today?.restaurant_revenue)}</td><td style="text-align:right;padding:10px 8px;color:#888;border-bottom:1px solid #f0f0f0;">${fmt(rev?.yesterday?.restaurant_revenue)}</td><td style="text-align:right;padding:10px 8px;border-bottom:1px solid #f0f0f0;">${fmt(rev?.week?.restaurant_revenue)}</td></tr>
      <tr style="background:#f8f6f0;"><td style="padding:10px 8px;font-weight:700;">TOTAL</td><td style="text-align:right;padding:10px 8px;font-weight:700;">${fmt(rev?.today?.total)}</td><td style="text-align:right;padding:10px 8px;color:#888;">${fmt(rev?.yesterday?.total)}</td><td style="text-align:right;padding:10px 8px;font-weight:700;">${fmt(rev?.week?.total)}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 16px 0;">
    <h2 style="font-size:16px;margin:0 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">🔮 7-Day Forecast</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${forecastHtml}</tr></table>
  </td></tr>
  <tr><td style="padding:20px 16px 0;">
    <h2 style="font-size:16px;margin:0 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">💡 Business Insights</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${insightsHtml}</table>
  </td></tr>
  <tr><td style="padding:24px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#f8f6f0;border-radius:12px;padding:20px;text-align:center;">
      <p style="margin:0 0 12px;font-size:14px;color:#555;">View the complete dashboard with charts, trends, and detailed breakdowns</p>
      <a href="https://keymanhotel.alerotek.co.ke/admin/business-deck" style="display:inline-block;padding:14px 32px;background:#1a1a2e;color:#c8a951;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">📊 View Full Business Deck</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="background:#f8f6f0;padding:20px 16px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:13px;color:#555;font-weight:600;">Keyman Hotel</p>
    <p style="margin:4px 0 0;font-size:11px;color:#999;">Business Intelligence Deck • Mwatate, Taita Taveta</p>
    <p style="margin:8px 0 0;font-size:10px;color:#bbb;font-style:italic;">This report contains confidential business data. Do not forward.</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;

  fs.writeFileSync('email-preview.html', html);
  console.log('✅ Email preview saved to email-preview.html');
  console.log('HTML size:', (html.length / 1024).toFixed(1), 'KB');
}

preview().catch(console.error);
