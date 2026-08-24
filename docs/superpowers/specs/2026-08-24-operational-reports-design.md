# Operational Reports Design — Room Performance, Menu Analytics, Forecasting

**Date:** 2026-08-24  
**Status:** Pending Review  
**Scope:** Three new report tabs under Reports: Room Performance, Menu Analytics, Temporal Forecasting

---

## Problem

The Reports page currently shows Occupancy, Revenue, Guest Insights, Bookings, and Reconciliation. Missing: room type performance analysis, food/menu analytics with profitability, and time-based forecasting. Manager and accountant need these to make pricing, menu, and staffing decisions.

## Goals

1. **Room Performance** — Which room types generate the most revenue, occupancy rates, ADR, RevPAR, length of stay, booking source breakdown, cancellation rate
2. **Menu Analytics** — Most popular items, revenue by item, profitability (price vs cost), combo analysis (items ordered together), time-of-day patterns
3. **Temporal Forecasting** — Revenue/occupancy trends by day/week/month, peak season identification, 30-day demand forecast based on historical patterns

---

## Tab 1: Room Performance

### Metrics

| Metric | Calculation | Purpose |
|---|---|---|
| **Revenue by Type** | Sum of `rate × nights` per room type | Which types earn most |
| **Occupancy Rate** | `occupied_nights / available_nights × 100` | How well rooms fill |
| **ADR** (Avg Daily Rate) | `total_room_revenue / rooms_sold` | Average rate achieved |
| **RevPAR** | `total_room_revenue / total_available_rooms` | Revenue per available room |
| **Avg Length of Stay** | `avg(check_out - check_in)` per type | How long guests stay |
| **Booking Source** | Count by `booking_source` (direct, OTA, phone, walk-in) | Where bookings come from |
| **Cancellation Rate** | `cancelled / total_bookings × 100` | How many cancel |
| **No-Show Rate** | `no_show / total_bookings × 100` | How many don't show |

### Charts

1. **Room Type Revenue** — Horizontal bar chart comparing revenue across room types (Single, Twin, Studio)
2. **Occupancy Trend** — Line chart showing daily occupancy % over selected period
3. **Booking Source Distribution** — Pie chart (Direct, OTA, Phone, Walk-in)
4. **ADR vs RevPAR** — Grouped bar chart comparing ADR and RevPAR by room type

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Room Performance                    [7d] [14d] [30d] [90d]         │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│ │Total │ │Occup │ │ ADR  │ │RevPAR│ │ Avg  │ │Cancel│           │
│ │Rev   │ │Rate  │ │KES 2k│ │KES 1k│ │LOS 2d│ │Rate 3%│          │
│ │KES 1M│ │ 72%  │ │      │ │      │ │      │ │      │           │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘           │
│                                                                     │
│ ┌── Revenue by Room Type ─┐ ┌── Occupancy Trend ───────────────┐  │
│ │ Single  ████████  450k  │ │  80% ·×·×·×·×·×·×·×·×·×·×       │  │
│ │ Twin    ██████    350k  │ │  70% ×·×·×·×·×·×·×·×·×·×·×      │  │
│ │ Studio  ████      200k  │ │  60%                             │  │
│ └─────────────────────────┘ └──────────────────────────────────┘  │
│                                                                     │
│ ┌── Booking Sources ──────┐ ┌── ADR vs RevPAR ────────────────┐  │
│ │  Direct 45%             │ │  Single  ████ ADR  ███ RevPAR  │  │
│ │  OTA 30%                │ │  Twin    ███   ███             │  │
│ │  Phone 15%              │ │  Studio  █████ ████            │  │
│ │  Walk-in 10%            │ │                                 │  │
│ └─────────────────────────┘ └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tab 2: Menu Analytics

### Metrics

| Metric | Calculation | Purpose |
|---|---|---|
| **Order Count by Item** | Count of `restaurant_order_items` per `menu_item_id` | Most popular items |
| **Revenue by Item** | `price × quantity` per item | Highest-earning items |
| **Item Profitability** | `(price - cost) / price × 100` | Margin per item (requires `cost` column on menu_items) |
| **Combo Analysis** | Items that appear together in same order | Cross-sell opportunities |
| **Time-of-Day Patterns** | Order items grouped by hour of day | Breakfast vs lunch vs dinner popularity |
| **Avg Order Value** | `avg(total)` per order | Spending per transaction |
| **Order Frequency by Day** | Orders grouped by day of week | Busiest days for kitchen |

### Charts

1. **Top Items by Revenue** — Horizontal bar chart, top 10 items
2. **Top Items by Volume** — Horizontal bar chart, top 10 items by count
3. **Menu Profitability** — Scatter plot (price vs cost, bubble size = order volume)
4. **Time-of-Day Heatmap** — Hour × day matrix showing order volume
5. **Combo Network** — Simple connection lines showing items frequently ordered together
6. **Revenue by Day of Week** — Bar chart showing which days earn most from food

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Menu Analytics                      [7d] [14d] [30d]               │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                    │
│ │Total │ │Total │ │ Avg  │ │Top   │ │Profit│                    │
│ │Orders│ │Rev   │ │Order │ │Item  │ │Margin│                    │
│ │  342 │ │KES 89k│ │KES260│ │Pilau │ │  42% │                    │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                    │
│                                                                     │
│ ┌── Top Items by Revenue ─┐ ┌── Top Items by Volume ──────────┐  │
│ │ Pilau      ████  28k    │ │ Pancakes   ████  89 orders     │  │
│ │ Spaghetti  ███   21k    │ │ Pilau      ███   76 orders     │  │
│ │ Pancakes   ██    15k    │ │ Spaghetti  ███   65 orders     │  │
│ └─────────────────────────┘ └──────────────────────────────────┘  │
│                                                                     │
│ ┌── Profitability ────────┐ ┌── Orders by Day ────────────────┐  │
│ │  Price vs Cost scatter  │ │  Mon ████  Tue █████  Wed ████  │  │
│ │  (bubble = volume)      │ │  Thu ███   Fri ██████ Sat █████ │  │
│ └─────────────────────────┘ └──────────────────────────────────┘  │
│                                                                     │
│ ┌── Time-of-Day Heatmap ───────────────────────────────────────┐  │
│ │         6am  8am  10am 12pm 2pm  4pm  6pm  8pm  10pm        │  │
│ │  Mon    ░░░  ███  ░░░  ████ ░░░  ░░░  ███  ██   ░           │  │
│ │  Tue    ░░░  ███  ░░░  ████ ░░░  ░░░  ███  ███  ░           │  │
│ │  ...                                                        │  │
│ └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tab 3: Temporal Forecasting

### Historical Analysis

| Metric | Breakdown |
|---|---|
| **Revenue by Period** | Daily, weekly, monthly aggregation |
| **Occupancy by Period** | Daily occupancy % trend |
| **Order Volume by Period** | Restaurant orders per day |
| **Peak Identification** | Highest revenue/occupancy days, seasons |
| **Period Comparison** | This period vs previous period (delta %) |

### Forecasting

- **30-Day Occupancy Forecast** — Based on historical average + day-of-week pattern + trend
- **Revenue Forecast** — Predicted revenue for next 30 days based on ADR × forecasted occupancy
- **Demand Heatmap** — Calendar view showing predicted high/medium/low demand days

### Charts

1. **Revenue Trend + Forecast** — Line chart with historical data + dashed forecast line
2. **Occupancy Trend + Forecast** — Same pattern
3. **Monthly Comparison** — Bar chart comparing same months across years
4. **Demand Calendar** — Calendar heatmap showing predicted demand (green/yellow/red)
5. **Seasonal Pattern** — Average occupancy by month across all years

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Temporal Forecasting                                                │
├─────────────────────────────────────────────────────────────────────┤
│ ┌── Revenue Trend + Forecast ───────────────────────────────────┐  │
│ │  KES 50k ···········××××××××××× (forecast)                   │  │
│ │  KES 40k ···×·×·×·×·×·×                                    │  │
│ │  KES 30k ×·×·×·×·×·×                                        │  │
│ │           ─────────────────────────────────                   │  │
│ │           Jul 1          Aug 1          Aug 24                │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│ ┌── Demand Calendar (Next 30 Days) ─┐ ┌── Seasonal Pattern ─────┐ │
│ │  Aug 2026                         │ │  Jan ████               │ │
│ │  Mon Tue Wed Thu Fri Sat Sun      │ │  Feb ███                │ │
│ │   25  26  27  28  29  30  31      │ │  Mar █████              │ │
│ │  🟢  🟡  🟡  🔴  🔴  🔴  🟡       │ │  Apr ████               │ │
│ │  Sep 2026                         │ │  May ███                │ │
│ │   01  02  03  04  05  06  07      │ │  Jun ██████             │ │
│ │  🟡  🟡  🟢  🟢  🟡  🔴  🔴       │ │  Jul ████████           │ │
│ └───────────────────────────────────┘ └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Sources

| Report | Tables | Key Columns |
|---|---|---|
| **Room Performance** | `rooms`, `room_types`, `reservations`, `folio_payments` | room_type_id, check_in, check_out, status, rate, booking_source |
| **Menu Analytics** | `menu_items`, `restaurant_order_items`, `restaurant_orders` | name, price, cost, quantity, created_at, total |
| **Temporal Forecasting** | `reservations`, `restaurant_orders`, `rooms` | check_in, check_out, created_at, status, total |

---

## Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `src/pages/admin/Reports.tsx` | **Modify** | Add 3 new tabs: Room Performance, Menu Analytics, Temporal Forecasting |
| `src/lib/reportUtils.ts` | **Modify** | Add computation functions for new metrics |

No new pages — everything goes into the existing Reports page as new tabs.

**DB Migration:** Add `cost` column (decimal) to `menu_items` table for profitability calculation. Default to 0 for existing items.

---

## Testing

1. E2E test: Verify Room Performance tab renders with correct metrics
2. E2E test: Verify Menu Analytics tab shows item rankings
3. E2E test: Verify Temporal Forecasting shows trend + forecast lines
4. E2E test: Verify date range filtering works across all 3 tabs
5. Existing E2E tests still pass (73/73)
