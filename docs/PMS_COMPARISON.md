# Keyman Hotel vs Industry-Standard Hotel PMS Systems

## Comparison Against: Opera PMS (Oracle), Cloudbeds, RoomRaccoon, Mews, HotelFriend

---

## Feature Coverage Matrix

| Feature | Industry Standard | Keyman Hotel | Status | Priority |
|---|---|---|---|---|
| **CORE OPERATIONS** | | | | |
| Reservation management | ✅ All PMS | ✅ Full CRUD | ✅ | — |
| Visual calendar/drag-drop | ✅ All PMS | ✅ BookingCalendar | ✅ | — |
| Room inventory management | ✅ All PMS | ✅ 21 rooms, 3 types | ✅ | — |
| Real-time availability | ✅ All PMS | ✅ Overlap detection | ✅ | — |
| Walk-in registration | ✅ All PMS | ✅ Receptionist PDA | ✅ | — |
| Check-in / Check-out | ✅ All PMS | ✅ Atomic functions | ✅ | — |
| Room status tracking | ✅ All PMS | ✅ available/occupied/dirty/clean | ✅ | — |
| Multi-rate support | ✅ All PMS | ⚠️ Single rate per type | MEDIUM | Add seasonal rates |
| Group bookings | ✅ All PMS | ❌ Not implemented | HIGH | Add rooming lists |
| Overbooking control | ✅ All PMS | ⚠️ Basic overlap check | MEDIUM | Add overbooking % setting |
| **CHANNEL MANAGEMENT** | | | | |
| OTA integration (Booking.com, Expedia) | ✅ All PMS | ❌ Not implemented | HIGH | Critical for revenue |
| Channel manager | ✅ All PMS | ❌ Not implemented | HIGH | Sync availability |
| Direct booking engine | ✅ All PMS | ✅ /guest/booking | ✅ | — |
| Rate parity | ✅ All PMS | ❌ Not implemented | MEDIUM | Same rate across channels |
| **PAYMENTS** | | | | |
| M-Pesa integration | 🇰🇪 Local standard | ✅ Paybill flow | ✅ | — |
| Card payments | ✅ All PMS | ⚠️ Toggle exists, not wired | HIGH | Stripe/Pesapal |
| Cash payments | ✅ All PMS | ✅ | ✅ | — |
| Deposit collection | ✅ All PMS | ✅ 50% configurable | ✅ | — |
| Pre-authorization | ✅ All PMS | ❌ Not implemented | MEDIUM | Hold card before stay |
| Refund workflow | ✅ All PMS | ⚠️ Partial (audit exists) | MEDIUM | Full refund flow |
| Multi-currency | ✅ International PMS | ❌ KES only | LOW | — |
| **GUEST EXPERIENCE** | | | | |
| Guest profiles | ✅ All PMS | ✅ guests table | ✅ | — |
| Stay history | ✅ All PMS | ⚠️ Implicit via reservations | MEDIUM | Add stays table |
| Guest preferences | ✅ All PMS | ⚠️ Basic (preferences JSON) | MEDIUM | Structured preferences |
| Pre-arrival messaging | ✅ Cloudbeds, Mews | ❌ Not implemented | HIGH | Email/SMS before check-in |
| Mobile check-in | ✅ Cloudbeds, Mews | ❌ Not implemented | HIGH | Self-service |
| Digital key | ✅ Opera, Mews | ❌ Not implemented | LOW | IoT integration |
| Guest portal | ✅ All PMS | ✅ /guest/* pages | ✅ | — |
| Feedback/survey | ✅ All PMS | ✅ meal_feedback | ✅ | Add post-stay survey |
| **HOUSEKEEPING** | | | | |
| Task assignment | ✅ All PMS | ✅ housekeeping_tasks | ✅ | — |
| Room inspection | ✅ Opera | ✅ HousekeepingSupervisor | ✅ | — |
| Real-time room status | ✅ All PMS | ✅ Room status updates | ✅ | — |
| Maintenance requests | ✅ All PMS | ⚠️ guest_requests | MEDIUM | Add maintenance module |
| Turndown service | ✅ Opera | ❌ Not implemented | LOW | — |
| **F&B / RESTAURANT** | | | | |
| POS integration | ✅ All PMS | ✅ Restaurant orders | ✅ | — |
| Room charge to folio | ✅ All PMS | ✅ folio_transactions | ✅ | — |
| B&B breakfast management | ⭐ Unique | ✅ Full system | ✅ | — |
| Menu management | ✅ All PMS | ✅ CRUD + analytics | ✅ | — |
| Table management | ✅ POS systems | ❌ Not implemented | MEDIUM | — |
| Delivery tracking | ⭐ Unique | ✅ Rider assignment | ✅ | — |
| **REVENUE MANAGEMENT** | | | | |
| Dynamic pricing | ✅ Opera, IDeaS | ❌ Not implemented | HIGH | Occupancy-based pricing |
| Seasonal rates | ✅ All PMS | ❌ Single rate | HIGH | Date-range pricing |
| Rate plans | ✅ All PMS | ❌ Not implemented | MEDIUM | BAR, corporate, packages |
| Upselling | ✅ Cloudbeds | ⚠️ Room upgrade at check-in | LOW | Automated upsell |
| RevPAR/ADR tracking | ✅ All PMS | ✅ KPI dashboard | ✅ | — |
| **REPORTING** | | | | |
| Occupancy reports | ✅ All PMS | ✅ Reports page | ✅ | — |
| Revenue reports | ✅ All PMS | ✅ Reports page | ✅ | — |
| Guest analytics | ✅ All PMS | ⚠️ Basic | MEDIUM | Demographics, repeat rate |
| Forecasts | ✅ Opera, IDeaS | ✅ TemporalForecasting | ✅ | — |
| Export (CSV/PDF) | ✅ All PMS | ❌ Not implemented | MEDIUM | — |
| **SECURITY** | | | | |
| Role-based access | ✅ All PMS | ✅ 8 roles | ✅ | — |
| Audit trail | ✅ All PMS | ✅ audit_logs | ✅ | — |
| PCI compliance | ✅ All PMS | ⚠️ No card storage | ✅ | — |
| 2FA | ✅ All PMS | ❌ Not implemented | MEDIUM | — |
| **INTEGRATIONS** | | | | |
| Open API | ✅ All PMS | ❌ Not implemented | HIGH | REST/webhook API |
| Channel manager API | ✅ All PMS | ❌ Not implemented | HIGH | — |
| Accounting integration | ✅ All PMS | ❌ Not implemented | MEDIUM | QuickBooks/Sage |
| SMS gateway | ✅ All PMS | ❌ Not implemented | HIGH | Africa's Talking |
| Email service | ✅ All PMS | ⚠️ useEmailService hook | MEDIUM | Production email |
| **LOYALTY** | | | | |
| Points system | ✅ Cloudbeds, RoomRaccoon | ✅ Full system | ✅ | — |
| Tier system | ✅ All PMS | ✅ Guest/Regular/VIP | ✅ | — |
| Referral program | ⭐ Unique | ✅ Built | ✅ | — |
| Campaign engine | ⭐ Unique | ✅ Built | ✅ | — |
| **UNIQUE TO KEYMAN** | | | | |
| B&B tracking codes | ⭐ Unique | ✅ KB-XXXX per dish | ✅ | — |
| Per-day breakfast picker | ⭐ Unique | ✅ Different items daily | ✅ | — |
| Breakfast change window | ⭐ Unique | ✅ 5hr cutoff + variance | ✅ | — |
| Kitchen live status | ⭐ Unique | ✅ Guest notifications | ✅ | — |
| Conference management | ✅ Some PMS | ✅ Booking + CMS | ✅ | — |
| External customer portal | ⭐ Unique | ✅ Walk-in orders | ✅ | — |

---

## Gap Analysis: Top 10 Missing Features

### 1. OTA Channel Manager (CRITICAL)
**What industry has:** Direct integration with Booking.com, Expedia, Airbnb, TripAdvisor
**What we have:** Manual bookings only
**Impact:** Hotels lose 30-50% of bookings without OTA presence
**Effort:** High — requires Open API + channel manager partnership (e.g., SiteMinder, Cloudbeds CM)

### 2. Dynamic/Seasonal Pricing (HIGH)
**What industry has:** Date-range rates, occupancy-based pricing, weekend premiums
**What we have:** Single rate per room type, year-round
**Impact:** Revenue loss of 15-25% from missed pricing opportunities
**Effort:** Medium — add rate_plans table + date-range pricing logic

### 3. Mobile Self-Service Check-in (HIGH)
**What industry has:** Pre-arrival email with check-in link, ID upload, digital key
**What we have:** Receptionist-only check-in
**Impact:** Reduces front desk congestion, improves guest experience
**Effort:** Medium — pre-arrival email flow + document upload

### 4. Card Payment Processing (HIGH)
**What industry has:** Stripe, Adyen, Pesapal integration with pre-authorization
**What we have:** M-Pesa only, manual verification
**Impact:** International guests can't pay, no pre-auth for incidentals
**Effort:** Medium — Stripe/Pesapal webhook integration

### 5. Group Bookings & Rooming Lists (MEDIUM)
**What industry has:** Block bookings, rooming lists, group rates, corporate accounts
**What we have:** Individual bookings only
**Impact:** Can't handle conference groups, corporate travel
**Effort:** Medium — group_booking table + bulk assignment

### 6. Pre-Arrival Communication (MEDIUM)
**What industry has:** Automated emails: booking confirmation → 7 days before → 1 day before → post-stay
**What we have:** Manual messaging only
**Impact:** Guest experience gap, missed upsell opportunities
**Effort:** Low — email templates + scheduled triggers

### 7. Post-Stay Survey & Reviews (MEDIUM)
**What industry has:** Automated survey after checkout, TripAdvisor/Google review integration
**What we have:** meal_feedback only (no post-stay survey)
**Impact:** No guest satisfaction tracking, no review generation
**Effort:** Low — survey template + email trigger

### 8. Export & Accounting (MEDIUM)
**What industry has:** CSV/PDF export, QuickBooks/Sage integration, tax reports
**What we have:** No export functionality
**Impact:** Manual accounting work, compliance risk
**Effort:** Low — CSV/PDF generation for key reports

### 9. 2FA / Multi-Factor Auth (MEDIUM)
**What industry has:** SMS/APP 2FA for admin access
**What we have:** Password-only
**Impact:** Security gap for admin/manager accounts
**Effort:** Low — Supabase MFA or TOTP

### 10. Open API (MEDIUM)
**What industry has:** REST API for third-party integrations
**What we have:** Supabase REST API (implicit)
**Impact:** Can't integrate with external systems
**Effort:** Medium — documented API layer

---

## What Keyman Hotel Does BETTER Than Most PMS

| Feature | Industry | Keyman | Why Better |
|---|---|---|---|
| **B&B breakfast tracking** | Most have generic "meal included" | Per-dish KB-XXXX codes | Granular control, no food waste |
| **Kitchen live status** | Most have no kitchen integration | Guest gets real-time alerts | Transparency, satisfaction |
| **Per-day breakfast picker** | Fixed packages only | Choose different items each morning | Personalization |
| **Breakfast change window** | No changes after booking | 5hr cutoff with variance tracking | Flexibility + revenue protection |
| **Referral + loyalty** | Paid add-on (Cloudbeds Engage) | Built-in with configurable points | No extra cost |
| **Conference CMS** | Separate system | Integrated with hotel PMS | One system for everything |
| **External customer portal** | Rare in small PMS | Walk-in orders without login | Upsell to non-guests |

---

## Implementation Roadmap

### Phase 1: Revenue Critical (Month 1-2)
1. **Seasonal/dynamic pricing** — date-range rates, weekend premiums
2. **Card payments** — Stripe/Pesapal integration
3. **Pre-arrival emails** — booking confirmation + check-in reminder
4. **Export functionality** — CSV/PDF for reports

### Phase 2: Growth (Month 3-4)
5. **OTA channel manager** — Booking.com/Expedia API
6. **Mobile check-in** — self-service pre-arrival
7. **Group bookings** — block bookings + rooming lists
8. **Post-stay survey** — automated feedback collection

### Phase 3: Enterprise (Month 5-6)
9. **Open API** — documented REST endpoints
10. **Accounting integration** — Sage/QuickBooks sync
11. **2FA** — admin security hardening
12. **Multi-property** — chain management

---

## Cost Comparison

| System | Monthly Cost | Keyman (Self-hosted) |
|---|---|---|
| Opera PMS | $500-2,000+/mo | — |
| Cloudbeds | $200-800/mo | — |
| RoomRaccoon | $150-500/mo | — |
| Mews | $300-1,000/mo | — |
| **Keyman Hotel** | **Hosting only (~$20/mo Vercel + Supabase)** | **90% cheaper** |

---

## Summary

**Current State:** Keyman Hotel covers ~70% of core PMS features for a small independent hotel, with unique B&B and kitchen features that most PMS systems lack entirely.

**Biggest Gaps:** OTA integration, dynamic pricing, card payments, and mobile check-in.

**Biggest Strengths:** B&B tracking, kitchen live status, loyalty/campaigns, conference management — all built-in at a fraction of the cost.

**Verdict:** Production-ready for a single-property independent hotel. Needs OTA and payment integration to compete with commercial PMS systems.
