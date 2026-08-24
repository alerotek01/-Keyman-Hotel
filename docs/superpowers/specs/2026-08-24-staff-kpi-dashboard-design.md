# Staff KPI Dashboard Design

**Date:** 2026-08-24  
**Status:** Pending Review  
**Scope:** Performance KPIs for staff — revenue, variance, punctuality — with composite scores, radar charts, leaderboard, and trend tracking

---

## Problem

Manager, admin, and accountant have no unified view of staff performance. Revenue data lives in payments/orders, variance lives in reconciliations, and punctuality data (shift start times) is scattered across staff_shifts. There's no way to compare staff performance, spot trends, or identify who needs coaching.

## Goals

1. **Composite KPI Score** — 0-100 score per staff member combining revenue, variance, and punctuality
2. **Radar Visualization** — Each staff member's strengths/weaknesses shown as a radar chart
3. **Leaderboard** — Rank all staff by composite score, filterable by department and date range
4. **Trend Charts** — KPI scores over time to track improvement or decline
5. **Access** — Manager, Admin, and Accountant can all view

---

## KPI Scoring Formula

### Composite Score (0-100)

```
Composite = (Revenue × 0.4) + (Variance Accuracy × 0.3) + (Punctuality × 0.3)
```

### Revenue Score (0-100) — Weight: 40%

Measures how much revenue the staff member generates during their shifts.

- Only applies to revenue-generating roles: **waiter**, **receptionist**
- For non-revenue roles (chef, housekeeper): score = 100 (no revenue expectation)
- Calculation:
  - Get all shifts for the staff in the period
  - Sum `sales_total` from their reconciliations
  - Compare against department average
  - Score = `(staff_sales / department_avg_sales) × 100`, capped at 100
  - Example: Staff KES 5,000, Dept avg KES 4,000 → score = 125 → capped at 100
  - Below average: score = `(staff_sales / department_avg_sales) × 100` (linear scale)

### Variance Accuracy Score (0-100) — Weight: 30%

Measures cash handling accuracy.

- Start at 100, deduct for each variance:
  - KES 0 variance = 100 (perfect)
  - Each KES 10 of variance = -1 point
  - Example: -KES 50 variance → 100 - 5 = 95
  - Example: +KES 200 variance → 100 - 20 = 80
- Floor at 0 (can't go negative)
- Only counts shifts with submitted reconciliations

### Punctuality Score (0-100) — Weight: 30%

Measures on-time shift starts.

- Scheduled start times based on shift_name:
  - `morning` = 06:00
  - `afternoon` = 14:00
  - `night` = 22:00
- Compare actual `start_time` to scheduled:
  - On time (≤5 min early or late) = 100
  - 6-15 min late = 80
  - 16-30 min late = 60
  - 31-60 min late = 40
  - >60 min late = 20
  - No-show (shift cancelled or status=not_started) = 0
- Average across all shifts in period

---

## Dashboard Layout

### Manager View (`/manager/kpi`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Staff Performance KPIs                                               │
│ [Date Range: Jul 25 - Aug 24]  [7d] [14d] [30d]  [Dept: All ▼]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌──── Composite Score ────────┐ ┌─── Trend (30 days) ────────────┐ │
│ │        ┌─────┐              │ │  95 ······×··················   │ │
│ │       ╱ Rev  ╲              │ │  90 ····×··×·····×··········   │ │
│ │      ╱  92    ╲             │ │  85 ·×·······×···×··×······   │ │
│ │     ╱─────────╲             │ │  80 ×·····················×   │ │
│ │    │ Var  Punc │            │ │     ───────────────────────   │ │
│ │    │  88   95  │            │ │     W1   W2   W3   W4        │ │
│ │     ╲─────────╱             │ │                                │ │
│ │      ╲       ╱              │ └────────────────────────────────┘ │
│ │       ╲─────╱               │                                     │
│ │        SCORE: 92            │ ┌─── Leaderboard ───────────────┐  │
│ │        Marcia Team          │ │ 1. Marcia Team    92  ★★★★★  │  │
│ │        Receptionist         │ │ 2. Waiter Test    87  ★★★★☆  │  │
│ │        Front Office         │ │ 3. Chef Test      84  ★★★★☆  │  │
│ └────────────────────────────┘ │ 4. Housekeeper T  80  ★★★★☆  │  │
│                                 └────────────────────────────────┘  │
│                                                                      │
│ ┌─── Department Averages ─────┐ ┌─── Individual Trends ──────────┐ │
│ │ Restaurant   ████████ 87    │ │  Marcia  ───×───×───×───  92  │ │
│ │ Kitchen      ███████  84    │ │  Waiter  ──×─────×──×────  87 │ │
│ │ Front Office ████████ 92    │ │  Chef    ──×──×──────×───  84 │ │
│ │ Housekeeping ██████   80    │ │  HK      ──────×───×─────  80 │ │
│ └─────────────────────────────┘ └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Sections

| Section | Description |
|---|---|
| **Composite Score Card** | Radar chart showing Revenue/Variance/Punctuality with overall 0-100 score |
| **Trend Chart** | Line chart showing composite scores over time (weekly aggregation) |
| **Leaderboard** | Sorted list of all staff with scores and star ratings |
| **Department Averages** | Horizontal bar chart comparing departments |
| **Individual Trends** | Mini sparklines per staff member showing score trajectory |

---

## Star Rating

Based on composite score:

| Score | Stars | Label |
|---|---|---|
| 90-100 | ★★★★★ | Outstanding |
| 80-89 | ★★★★☆ | Excellent |
| 70-79 | ★★★☆☆ | Good |
| 60-69 | ★★☆☆☆ | Needs Improvement |
| <60 | ★☆☆☆☆ | At Risk |

---

## Data Flow

```
1. Query shift_reconciliations JOIN staff_shifts JOIN users JOIN departments
   → Filter by date range + department
   → Group by staff member

2. For each staff member, compute:
   a. Revenue Score = (staff_sales / dept_avg_sales) × 100
   b. Variance Score = 100 - (|total_variance| / 10)
   c. Punctuality Score = avg(on_time_score across all shifts)

3. Composite = (revenue × 0.4) + (variance × 0.3) + (punctuality × 0.3)

4. For trends: compute composite score per day over selected period, with 7-day moving average line overlay

5. Render: radar chart, leaderboard, trend lines
```

---

## Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `src/pages/manager/KpiDashboard.tsx` | **Create** | Main KPI dashboard page |
| `src/lib/kpi.ts` | **Create** | KPI computation functions (scores, trends, rankings) |
| `src/App.tsx` | **Modify** | Add route `/manager/kpi` |
| `src/pages/manager/ManagerLayout.tsx` | **Modify** | Add "Staff KPIs" nav item |

---

## Testing

1. E2E test: Seed shifts with known start times → verify punctuality score calculation
2. E2E test: Seed reconciliations with known variances → verify variance score
3. E2E test: Seed orders with known totals → verify revenue score
4. E2E test: Verify composite score matches weighted formula
5. E2E test: Verify leaderboard sorting (highest score first)
6. Existing E2E tests still pass (73/73)
