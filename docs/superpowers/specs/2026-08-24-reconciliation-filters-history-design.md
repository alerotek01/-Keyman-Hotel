# Reconciliation Filters, Staff Shift History & Export Design

**Date:** 2026-08-24  
**Status:** Approved  
**Scope:** Manager reconciliation filtering, staff shift history with drill-down, CSV/PDF export

---

## Problem

As operations grow, reconciliation records pile up. Managers can't efficiently find specific shifts. Staff have no visibility into their own past shifts, transactions, or downloadable records. There's no way to export reconciliation data for external accounting or record-keeping.

## Goals

1. **Manager filtering** — Filter reconciliation history by department, staff name, date range, status
2. **Staff shift history** — Every role (waiter, chef, housekeeper, receptionist) sees their full shift history with transaction drill-down
3. **Export** — Each shift record downloadable as CSV and PDF
4. **Consistency** — Same filter UX across manager and staff views

---

## Design

### 1. Shared FilterBar Component

A reusable `FilterBar` component with 4 filter controls:

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔍 [Search name...]  [Department ▼]  [Date From] [Date To]  [Clear]│
└─────────────────────────────────────────────────────────────────────┘
```

| Filter | Type | Options |
|---|---|---|
| **Name** | Text input with autocomplete | Filters by `full_name` (client-side fuzzy match) |
| **Department** | Select dropdown | All, Restaurant, Kitchen, Front Office, Housekeeping |
| **Date From** | Date picker | Defaults to 30 days ago |
| **Date To** | Date picker | Defaults to today |
| **Status** | Multi-select chips | Pending, Explained, Flagged, Approved, Reconciled |

- Filter state is URL-search-params based (shareable links)
- Clear button resets all filters
- Filter counts update in real-time as filters change

**File:** `src/components/FilterBar.tsx`

### 2. Manager Reconciliation Page Updates

Add the FilterBar above the existing tabs. The stats cards update to reflect filtered counts.

```
┌──────────────────────────────────────────────────┐
│ Reconciliation                                    │
│ [Send Midnight Audit Report]                      │
│                                                   │
│ 🔍 [Search...]  [Dept ▼]  [From] [To]  [Clear]  │
│                                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ │
│ │ Pending  │ │Explained │ │ Approved │ │Flagged│ │
│ │    4     │ │    1     │ │    7     │ │   0  │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────┘ │
│                                                   │
│ Tabs: Pending(4) | Explained(1) | Flagged(0) | History(7) │
│                                                   │
│ [Each card now has: Download CSV | Download PDF]  │
└──────────────────────────────────────────────────┘
```

- FilterBar filters across ALL tabs simultaneously
- Stats cards show filtered counts (not total)
- History tab gets a date range picker by default (last 30 days)

### 3. Staff Shift History Page

New page at `/staff/shifts` (linked from Shift Mgmt nav item).

```
┌──────────────────────────────────────────────────┐
│ Shift History                                     │
│                                                   │
│ 🔍 [Search...]  [Date From] [Date To]  [Clear]   │
│                                                   │
│ Total Shifts: 12  │  Total Earnings: KES 45,000  │
│                                                   │
│ ┌──────────────────────────────────────────────┐ │
│ │ Morning Shift · Aug 24, 2026                 │ │
│ │ ✅ Reconciled · KES 4,340 sales             │ │
│ │ Variance: -KES 50 (resolved)                 │ │
│ │ [View Details] [📄 CSV] [📑 PDF]            │ │
│ ├──────────────────────────────────────────────┤ │
│ │ Evening Shift · Aug 23, 2026                 │ │
│ │ ✅ Reconciled · KES 3,200 sales             │ │
│ │ Variance: KES 0 (none)                       │ │
│ │ [View Details] [📄 CSV] [📑 PDF]            │ │
│ └──────────────────────────────────────────────┘ │
│                                                   │
│ (Expandable: same transaction drill-down as       │
│  manager view — payments with M-Pesa codes,       │
│  receipts, orders)                                │
└──────────────────────────────────────────────────┘
```

**Features:**
- Pre-filtered to current user's shifts only
- Same FilterBar (without department filter — user only has one dept)
- Expandable rows with full transaction drill-down (reuses `get_shift_transactions` function)
- Download CSV/PDF per shift
- Summary stats: total shifts, total sales, average variance

### 4. CSV Export

Each shift generates a CSV with:

```csv
Shift Summary
Staff,Role,Department,Shift,Date,Duration
Waiter Test,waiter,Restaurant,Morning,2026-08-24,480min

Sales Summary
Total Sales,Cash,M-Pesa,Card,Variance
4340,750,3590,0,-50

Transactions
#,Time,Type,Description,Amount,Method,M-Pesa Code,Proof
1,05:00,Payment,Food order,800,M-Pesa,SEED_UMQ4W9B3AC,Yes
2,06:30,Payment,Walk-in,450,Cash,,Yes
...

Orders
#,Guest,Type,Status,Amount,Time
23,E2E_RECON_James,Dine-in,Delivered,800,04:30
```

**File:** `src/lib/export.ts`

### 5. PDF Export

Each shift generates a formatted PDF report:

```
┌──────────────────────────────────────────┐
│  🏨 KEYMAN HOTEL                         │
│  Shift Reconciliation Report             │
│                                          │
│  Staff: Waiter Test                      │
│  Role: Waiter · Restaurant               │
│  Shift: Morning · Aug 24, 2026           │
│  Duration: 8 hours                       │
│                                          │
│  ─── Sales Summary ───                   │
│  Total Sales:    KES 4,340               │
│  Cash:           KES 750                 │
│  M-Pesa:         KES 3,590               │
│  Card:           KES 0                   │
│  Variance:       -KES 50 (short)         │
│                                          │
│  ─── Transactions (6) ───                │
│  [Table with all payments]               │
│                                          │
│  ─── Orders (17) ───                     │
│  [Table with all orders]                 │
│                                          │
│  Status: Reconciled                      │
│  Manager: Manager Test                   │
│  Approved: Aug 24, 2026                  │
│                                          │
│  Generated: Aug 24, 2026 23:45          │
└──────────────────────────────────────────┘
```

**Approach:** Use browser's `window.print()` with a print-specific CSS stylesheet. This avoids adding a heavy PDF library (jspdf/html2canvas) and produces clean, professional output.

**File:** `src/lib/export.ts` (add `generatePrintableReport()` function)

### 6. Nav Updates

| Role | Current Nav | New Nav Item |
|---|---|---|
| Waiter | Shift Mgmt | Shift Mgmt → opens ShiftHistory page |
| Chef | Shift Mgmt | Shift Mgmt → opens ShiftHistory page |
| Receptionist | Shift Mgmt | Shift Mgmt → opens ShiftHistory page |
| Housekeeper | Shift Mgmt | Shift Mgmt → opens ShiftHistory page |
| Manager | Reconciliation | Reconciliation (with filters added) |

Staff "Shift Mgmt" nav item keeps the existing ShiftManager page but adds a **"History" tab** alongside "Current Shift". The History tab shows the full shift history with filters and export.

---

## Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `src/components/FilterBar.tsx` | **Create** | Shared filter component |
| `src/lib/export.ts` | **Create** | CSV generation + PDF print |
| `src/pages/staff/ShiftManager.tsx` | **Modify** | Add "History" tab with filters and export |
| `src/pages/manager/Reconciliation.tsx` | **Modify** | Add FilterBar, update stats to reflect filters |
| `src/config/navigation.ts` | No change | Existing nav works |

---

## Data Flow

```
Manager Reconciliation:
  DB → shift_reconciliations + staff_shifts + users + departments
  → Query with JOINs (existing)
  → Client-side FilterBar filters
  → Render filtered cards with expand + export

Staff Shift History:
  DB → get_shift_transactions(staff_id, date) [existing function]
  → Query staff_shifts WHERE user_id = current user
  → Client-side date/status filters
  → Render history cards with expand + export

Export:
  Expand card → click CSV/PDF → generate from in-memory data
  CSV: string concatenation → Blob → download
  PDF: render hidden div → window.print() → CSS @media print
```

---

## Testing

1. E2E test: Create shifts → filter by department → verify correct results
2. E2E test: Create shifts → filter by date range → verify correct results  
3. E2E test: Staff views shift history → expand → verify transactions show
4. E2E test: CSV download → verify file contains correct data
5. E2E test: PDF download → verify print dialog opens with correct content
6. Existing E2E tests still pass (73/73)
