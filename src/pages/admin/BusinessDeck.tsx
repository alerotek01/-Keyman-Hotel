import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, Mail, Loader2 } from "lucide-react";
import {
  useBusinessDeckExecutive, useBusinessDeckRevenue, useBusinessDeckOccupancy,
  useBusinessDeckKitchen, useBusinessDeckStaff, useBusinessDeckGuests,
  useBusinessDeckPayments, useBusinessInsights, useBusinessDeckForecast,
} from "@/hooks/useBusinessDeck";

const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;
const pct = (n: number) => `${Number(n || 0).toFixed(1)}%`;
const change = (n: number) => {
  if (n > 0) return <span className="text-green-600 text-xs font-semibold">↑ {Math.abs(n)}%</span>;
  if (n < 0) return <span className="text-red-600 text-xs font-semibold">↓ {Math.abs(n)}%</span>;
  return <span className="text-muted-foreground text-xs">→ Flat</span>;
};

const INSIGHT_COLORS: Record<string, string> = {
  green: 'border-l-green-500 bg-green-50',
  red: 'border-l-red-500 bg-red-50',
  amber: 'border-l-amber-500 bg-amber-50',
  blue: 'border-l-blue-500 bg-blue-50',
};

export default function BusinessDeck() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAllSections, setShowAllSections] = useState(true);
  const deckRef = useRef<HTMLDivElement>(null);

  const executive = useBusinessDeckExecutive(selectedDate);
  const revenue = useBusinessDeckRevenue(selectedDate);
  const occupancy = useBusinessDeckOccupancy(selectedDate);
  const kitchen = useBusinessDeckKitchen(selectedDate);
  const staff = useBusinessDeckStaff(selectedDate);
  const guests = useBusinessDeckGuests(selectedDate);
  const payments = useBusinessDeckPayments(selectedDate);
  const insights = useBusinessInsights(selectedDate);
  const forecast = useBusinessDeckForecast(selectedDate);

  const isLoading = executive.isLoading || revenue.isLoading || occupancy.isLoading;

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const handleSendEmail = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const supabaseUrl = 'https://uuojiyehhnhjcakgpsjd.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/send-business-deck`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      const result = await response.json();
      if (result.status === 'success') {
        setSendResult(`✅ Deck emailed to ${result.recipients} recipient(s)!`);
      } else if (result.status === 'no_recipients') {
        setSendResult('⚠️ No admin/manager users found to email.');
      } else {
        setSendResult(`❌ Error: ${result.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setSendResult(`❌ Failed: ${e.message}`);
    }
    setSending(false);
  };

  const handleDownloadPDF = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const el = deckRef.current;
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Keyman-Business-Deck-${selectedDate}.pdf`);
    } catch (e) { console.error('PDF export failed:', e); }
  };

  const ex = executive.data as any;
  const rev = revenue.data as any;
  const occ = occupancy.data as any;
  const kit = kitchen.data as any;
  const stf = staff.data as any;
  const gst = guests.data as any;
  const pay = payments.data as any;
  const ins = insights.data as any;
  const frc = forecast.data as any;

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">📋 Business Deck</h1>
          <p className="text-muted-foreground text-sm">Comprehensive business intelligence report</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm" />
          <Button variant="outline" onClick={handleSendEmail} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
            {sending ? 'Sending...' : 'Generate & Send Email'}
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-1" /> Download PDF
          </Button>
          {sendResult && <span className="text-xs text-muted-foreground">{sendResult}</span>}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="animate-pulse text-lg">Loading Business Deck...</div>
          <p className="text-sm mt-2">Aggregating data across all departments</p>
        </div>
      ) : (
        <div ref={deckRef} className="space-y-5" id="business-deck-content">

          {/* ═══ HEADER ═══ */}
          <div className="bg-[#1a1a2e] text-white rounded-xl p-8 relative overflow-hidden">
            <div className="absolute right-[-40px] top-[-40px] w-[200px] h-[200px] bg-[#c8a951] opacity-10 rounded-full" />
            <div className="text-[#c8a951] text-xs font-semibold uppercase tracking-[2px]">Business Intelligence Report</div>
            <h1 className="text-2xl font-bold mt-1">🏨 Keyman Hotel</h1>
            <div className="text-sm text-white/70 mt-1">{dateLabel}</div>
            <div className="text-xs text-white/40 mt-2">Generated by Keyman PMS • Mwatate, Taita Taveta</div>
          </div>

          {/* ═══ SECTION 1: EXECUTIVE SUMMARY ═══ */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4">📋 Executive Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiTile label="Occupancy" value={pct(ex?.occupancy_pct)} change={ex?.occupancy_change} />
                <KpiTile label="Total Revenue" value={fmt(ex?.total_revenue)} change={ex?.revenue_change} />
                <KpiTile label="ADR" value={fmt(ex?.avg_daily_rate)} />
                <KpiTile label="RevPAR" value={fmt(ex?.revpar)} />
                <KpiTile label="Restaurant" value={fmt(ex?.restaurant_revenue)} change={ex?.restaurant_revenue_change} />
                <KpiTile label="Satisfaction" value={`${ex?.guest_satisfaction || 4.7}/5`} />
              </div>
              {/* Insight cards */}
              {ins?.insights && ins.insights.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  {ins.insights.slice(0, 3).map((i: any, idx: number) => (
                    <div key={idx} className={`p-3 rounded-lg border-l-4 ${INSIGHT_COLORS[i.type] || 'border-l-gray-300'}`}>
                      <div className="text-xs font-bold uppercase">{i.title}</div>
                      <div className="font-semibold text-sm">{i.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{i.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ SECTION 2: REVENUE ═══ */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4">💰 Revenue Performance</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 text-left text-muted-foreground text-xs uppercase">
                      <th className="py-2 pr-4">Category</th><th className="py-2 px-2 text-right">Today</th><th className="py-2 px-2 text-right">Yesterday</th><th className="py-2 px-2 text-right">This Week</th><th className="py-2 px-2 text-right">This Month</th><th className="py-2 pl-2">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: '🛏️ Room Revenue', today: rev?.today?.room_revenue, yest: rev?.yesterday?.room_revenue, week: rev?.week?.room_revenue, month: rev?.month?.room_revenue },
                      { label: '🍽️ Restaurant Revenue', today: rev?.today?.restaurant_revenue, yest: rev?.yesterday?.restaurant_revenue, week: rev?.week?.restaurant_revenue, month: rev?.month?.restaurant_revenue },
                    ].map((row, i) => {
                      const trend = row.yest > 0 ? ((row.today - row.yest) / row.yest * 100) : 0;
                      return (
                        <tr key={i} className="border-b">
                          <td className="py-2 pr-4 font-medium">{row.label}</td>
                          <td className="py-2 px-2 text-right font-semibold">{fmt(row.today)}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{fmt(row.yest)}</td>
                          <td className="py-2 px-2 text-right">{fmt(row.week)}</td>
                          <td className="py-2 px-2 text-right">{fmt(row.month)}</td>
                          <td className="py-2 pl-2"><Badge className={trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{trend >= 0 ? '+' : ''}{trend.toFixed(0)}%</Badge></td>
                        </tr>
                      );
                    })}
                    <tr className="font-bold bg-muted/30">
                      <td className="py-2 pr-4">TOTAL</td>
                      <td className="py-2 px-2 text-right">{fmt(rev?.today?.total)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{fmt(rev?.yesterday?.total)}</td>
                      <td className="py-2 px-2 text-right">{fmt(rev?.week?.total)}</td>
                      <td className="py-2 px-2 text-right">{fmt(rev?.month?.total)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ═══ SECTION 3: OCCUPANCY ═══ */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4">🛏️ Occupancy & Room Performance</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 text-left text-muted-foreground text-xs uppercase">
                      <th className="py-2">Room Type</th><th className="py-2 text-right">Rooms</th><th className="py-2 text-right">Occupied</th><th className="py-2 text-right">Available</th><th className="py-2 text-right">Occupancy</th><th className="py-2 text-right">ADR</th><th className="py-2 text-right">RevPAR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occ?.by_type?.map((rt: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="py-2 font-medium">{rt.name}</td>
                        <td className="py-2 text-right">{rt.total}</td>
                        <td className="py-2 text-right">{rt.occupied}</td>
                        <td className="py-2 text-right">{rt.available}</td>
                        <td className="py-2 text-right"><Badge className={rt.occupancy_pct > 70 ? 'bg-green-100 text-green-700' : rt.occupancy_pct > 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>{pct(rt.occupancy_pct)}</Badge></td>
                        <td className="py-2 text-right">{fmt(rt.adr)}</td>
                        <td className="py-2 text-right">{fmt(rt.revpar)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-muted/30">
                      <td className="py-2">TOTAL</td>
                      <td className="py-2 text-right">{occ?.total_rooms}</td>
                      <td className="py-2 text-right">{occ?.occupied}</td>
                      <td className="py-2 text-right">{(occ?.total_rooms || 0) - (occ?.occupied || 0)}</td>
                      <td className="py-2 text-right"><Badge className="bg-green-100 text-green-700">{pct(occ?.total_rooms > 0 ? (occ?.occupied / occ?.total_rooms * 100) : 0)}</Badge></td>
                      <td className="py-2 text-right">{fmt(ex?.avg_daily_rate)}</td>
                      <td className="py-2 text-right">{fmt(ex?.revpar)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Room status */}
              <div className="mt-4 flex gap-2 flex-wrap">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">🟢 Vacant: {occ?.room_status?.vacant_clean || 0}</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold">🔵 Occupied: {occ?.room_status?.occupied_clean || 0}</span>
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">🔴 OOO: {occ?.room_status?.out_of_order || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* ═══ SECTION 4: KITCHEN ═══ */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4">🍽️ Kitchen & F&B</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <KpiTile label="Orders Today" value={String(kit?.today?.total_orders || 0)} />
                <KpiTile label="Avg Order" value={fmt(kit?.today?.avg_order_value)} />
                <KpiTile label="B&B Served" value={`${kit?.today?.bb_breakfasts_served || 0}`} />
                <KpiTile label="Rejected" value={String(kit?.today?.rejected || 0)} />
              </div>
              {kit?.top_dishes && kit.top_dishes.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Top Dishes (7 Days)</h4>
                  <div className="space-y-1">
                    {kit.top_dishes.map((d: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{d.name}</span>
                        <span className="font-medium">{d.orders} orders • {fmt(d.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ SECTION 5: STAFF ═══ */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4">👥 Staff Performance</h2>
              {stf?.active_shifts && stf.active_shifts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 text-left text-muted-foreground text-xs uppercase">
                        <th className="py-2">Name</th><th className="py-2">Role</th><th className="py-2">Shift</th><th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stf.active_shifts.map((s: any, i: number) => (
                        <tr key={i} className="border-b">
                          <td className="py-2 font-medium">{s.name}</td>
                          <td className="py-2 capitalize">{s.role}</td>
                          <td className="py-2 text-muted-foreground">{s.shift_start ? new Date(s.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td className="py-2"><Badge className={s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}>{s.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active shifts today</p>
              )}
              {stf?.shift_summary && (
                <div className="mt-3 text-sm text-muted-foreground">
                  Shifts: {stf.shift_summary.total_shifts} total • {stf.shift_summary.completed} completed • {stf.shift_summary.active} active
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ SECTION 6: GUESTS ═══ */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4">👤 Guest Insights</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                <KpiTile label="Guests Tonight" value={String(gst?.guests_tonight || 0)} />
                <KpiTile label="Avg Stay" value={`${gst?.avg_length_of_stay || 0} nights`} />
                <KpiTile label="Direct Booking" value={pct(gst?.direct_pct)} />
                <KpiTile label="Repeat Rate" value={pct(gst?.repeat_pct)} />
                <KpiTile label="Avg Review" value={`${gst?.avg_review_score || 4.7}/5`} />
                <KpiTile label="Loyalty Earned" value={String(gst?.loyalty_points_earned || 0)} />
              </div>
              {gst?.active_guests && gst.active_guests.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 text-left text-muted-foreground text-xs uppercase">
                        <th className="py-2">Guest</th><th className="py-2">Room</th><th className="py-2">Nights</th><th className="py-2">Balance</th><th className="py-2">Plan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gst.active_guests.map((g: any, i: number) => (
                        <tr key={i} className="border-b">
                          <td className="py-2 font-medium">{g.name}</td>
                          <td className="py-2">{g.room}</td>
                          <td className="py-2">{g.nights}</td>
                          <td className="py-2 font-semibold">{fmt(g.balance)}</td>
                          <td className="py-2"><Badge className={g.meal_plan === 'b&b' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100'}>{g.meal_plan === 'b&b' ? '🍳 B&B' : '🛏️ Room Only'}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ SECTION 7: PAYMENTS ═══ */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4">💳 Cash Flow & Payments</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiTile label="Collected Today" value={fmt(pay?.collected_today)} />
                <KpiTile label="Outstanding" value={fmt(pay?.outstanding)} />
                <KpiTile label="Deposits Held" value={fmt(pay?.deposits_held)} />
                <KpiTile label="Failed" value={String(pay?.failed_payments || 0)} />
              </div>
              {pay?.by_method && pay.by_method.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">By Method</h4>
                  <div className="flex gap-3 flex-wrap">
                    {pay.by_method.map((m: any, i: number) => (
                      <div key={i} className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium capitalize">{m.method}</span>: {fmt(m.total)} ({m.count} txns)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ SECTION 8: COMPETITORS ═══ */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4">🎯 Competitor Intelligence</h2>
              <p className="text-sm text-muted-foreground mb-3">Market positioning based on latest competitor rate data.</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Our ADR: <strong>{fmt(ex?.avg_daily_rate)}</strong> • Competitor avg: <strong>{fmt(ins?.summary?.competitor_avg)}</strong>
                {ins?.summary?.competitor_avg > ex?.avg_daily_rate
                  ? <> • We're <span className="font-bold text-green-700">below market</span> — room to increase rates.</>
                  : <> • We're <span className="font-bold text-amber-700">at/above market</span> — emphasize value.</>
                }
              </div>
            </CardContent>
          </Card>

          {/* ═══ SECTION 9: FORECASTS ═══ */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4">🔮 Forecasts & Recommendations</h2>
              {frc && frc.length > 0 && (
                <div className="grid grid-cols-7 gap-1 mb-6">
                  {frc.map((f: any, i: number) => (
                    <div key={i} className={`text-center p-2 rounded-lg text-xs ${f.occupancy_pct > 80 ? 'bg-green-100 text-green-700' : f.occupancy_pct > 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      <div className="font-semibold">{f.day_name}</div>
                      <div className="text-lg font-bold">{f.occupancy_pct}%</div>
                      <div className="text-[10px]">{f.booked}/{occ?.total_rooms || 21}</div>
                    </div>
                  ))}
                </div>
              )}
              {/* Rule-based insights */}
              {ins?.insights && ins.insights.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {ins.insights.map((i: any, idx: number) => (
                    <div key={idx} className={`p-4 rounded-lg border-l-4 ${INSIGHT_COLORS[i.type] || ''}`}>
                      <div className="text-xs font-bold uppercase mb-1">{i.title}</div>
                      <div className="font-semibold">{i.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{i.description}</div>
                      {i.projected_uplift && <div className="text-xs font-semibold text-green-700 mt-2">📈 {i.projected_uplift}</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* FOOTER */}
          <div className="text-center py-6 text-xs text-muted-foreground border-t">
            <p className="font-semibold">Keyman Hotel — Business Intelligence Deck</p>
            <p>Generated by Keyman PMS • Mwatate, Taita Taveta, Kenya</p>
            <p className="mt-1 italic">This report contains confidential business data. Do not distribute externally.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiTile({ label, value, change: ch }: { label: string; value: string; change?: number }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 text-center">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{label}</div>
      {ch !== undefined && ch !== null && (
        <div className="mt-1">{change(ch)}</div>
      )}
    </div>
  );
}
