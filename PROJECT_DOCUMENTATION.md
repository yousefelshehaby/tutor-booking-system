# Tutor Booking & Payment System — Project Documentation

This document is a complete, verified snapshot of the system as it exists right now. Every fact below was checked against the actual source code and the live Supabase database (table/column list and RPC list pulled directly from the live PostgREST schema, not from memory).

---

## 1. Project Overview

### What it does

A multi-tenant web platform for private tutors in Egypt to run their own student booking and payment operation:

- A student picks a tutor from a public directory, books a seat in a study group, and pays online (card, mobile wallet, or Fawry) — or reserves a seat without paying for 48 hours.
- Once enrolled, the student can pay recurring monthly subscription fees and see a full account statement.
- A student who works with more than one tutor can see all of it in one place ("حسابي").
- Each tutor gets an admin panel to manage grades/groups, see and manage their students, track payments, export to Excel, and delegate read-only/note-taking access to assistants (TAs).
- A super admin oversees every tutor on the platform: onboarding new tutors, managing their Paymob credentials, approving TA hiring requests, and cross-tutor reporting.
- All money moves directly from the student's card/wallet to the tutor's own Paymob merchant account — the platform never touches funds.

### Tech stack

- **Next.js 16** (App Router, Turbopack, TypeScript strict mode)
- **React 19**
- **Supabase**: Postgres database, Row Level Security as the primary authorization boundary, Supabase Auth for admin/tutor/TA login (students never authenticate — every student-facing flow is anonymous + phone/code based)
- **Tailwind CSS v4**, RTL/Arabic UI throughout
- **Paymob** (Egyptian payment gateway) — classic API integration (auth → order → payment key → iframe/pay), HMAC-SHA512 signed webhooks
- **exceljs** — styled multi-sheet Excel export
- **Zod** — input validation on every server action

### Live deployment

- **Live URL**: `https://tutor-booking-system-nad9.vercel.app`
- **GitHub repo**: `https://github.com/yousefelshehaby/tutor-booking-system`
- **Hosting**: Vercel, auto-deploys on every push to `main` (GitHub integration, no CI config beyond that)
- **Database**: Supabase project `lajnkunqvhgbrcwwaaaq`

### How migrations are applied

There is no Supabase CLI or direct Postgres connection available in the development environment this project was built in. Every one of the 24 migration files under `supabase/migrations/` was applied manually by pasting its SQL into the Supabase Dashboard's **SQL Editor**, in order, after each was written. This is also the documented process in `README.md` for anyone continuing the project. `scripts/reset-all-data.sql` is a separate, manually-triggered script (also run via SQL Editor) for wiping all tutors/students/TAs before a real handover, keeping only the super admin account.

### Current live data snapshot (at time of writing)

- 2 tutors: `mr-yousef` (active, Paymob card/wallet/Fawry/iframe IDs configured) and `me-abdalla` (inactive, no Paymob credentials yet)
- 6 admin accounts: 1 super admin, 2 tutors, 3 TAs

---

## 2. User Roles & Permissions Matrix

Four distinct actors. Students never log in; the other three are rows in `admin_users` distinguished by a `role` column (`'tutor' | 'ta' | 'super_admin'`).

| Capability | Student | TA | Tutor | Super Admin |
|---|:---:|:---:|:---:|:---:|
| Browse tutor directory / book a seat | ✅ | — | — | — |
| Pay for a booking (card/wallet/Fawry) or reserve without paying | ✅ | — | — | — |
| Pay monthly subscription | ✅ | — | — | — |
| View own account statement (single tutor) | ✅ | — | — | — |
| View own activity across ALL tutors ("حسابي") | ✅ | — | — | — |
| View "طلابي" (students list) for their own tutor(s) | — | ✅ (read-only) | ✅ | ✅ (any tutor, with filter) |
| View كشف/monthly strip, notes, booking details | — | ✅ | ✅ | ✅ |
| Add a note to a student | — | ✅ | ✅ | ✅ |
| Mark a booking/monthly fee as paid manually | — | ❌ | ✅ | ✅ |
| Cancel a booking | — | ❌ | ✅ | ✅ |
| Archive ("delete") / restore a student | — | ❌ | ✅ (own tutor) | ✅ |
| Manage grades/groups | — | ❌ (read-only) | ✅ | ✅ (any tutor) |
| Manage settings (booking open/closed, current month) | — | ❌ | ✅ | ✅ |
| Export bookings/monthly payments to Excel | — | ❌ | ✅ | ✅ (all tutors or filtered) |
| Request a new TA (formal request queue) | — | — | ✅ | — (approves instead) |
| Create a TA account | — | — | ❌ | ✅ (creates directly, or approves a tutor's request) |
| Assign/remove which tutors a TA can switch between | — | — | ❌ | ✅ |
| Switch which of their own linked tutors is active | — | ✅ (if linked to >1) | — | — |
| Create a new tutor account | — | — | — | ✅ |
| Edit any tutor's profile (name/slug/phone/photo/bank info) | — | — | own only (via same panel) | ✅ (any) |
| Edit any tutor's Paymob credentials | — | — | — (not exposed to tutor role) | ✅ |
| Change a tutor's login email | — | — | — | ✅ |
| Reset a tutor's or TA's password (generates new, shown once) | — | — | — | ✅ |
| View a password already set | — | — | — | ❌ — impossible for anyone; passwords are hashed by Supabase Auth and cannot be retrieved, only reset |
| Switch into managing a specific tutor | — | — | — | ✅ |

**Enforcement**: every "❌" above is enforced at the database level via Row Level Security, not just hidden in the UI — verified repeatedly during development by issuing raw REST calls as each role and confirming the database itself rejects the write (see Section 8).

---

## 3. Student-Facing Pages

All routes below are public/anonymous — no login involved.

### `/` — Tutor directory
Lists every active tutor (name + photo) as a link to their landing page. Shows a graceful Arabic empty state ("لا يوجد مدرّسون متاحون حاليًا") if there are none. Rendered dynamically per-request (previously statically cached at build time — fixed, see Section 7). Footer has a discreet "دخول المدرّسين والمساعدين" link to `/admin/login`, and a "حسابي" link in the header to the cross-tutor account page.

### `/[tutorSlug]` — Tutor landing page
Shows the tutor's name/photo, then a phone-number entry field (`PhoneFirstEntry` component). Based on what that phone resolves to:
- **No booking found** → "احجز لأول مرة" button → booking wizard.
- **An already-PAID booking found** → routes straight into the monthly statement flow.
- **An active UNPAID reservation found** (reserve_only not yet expired, or any pending payment) → shows that existing reservation (code, group, hours-remaining countdown) with an "ادفع الآن" button — prevents creating duplicate holds on the same seat.
- 404s to a friendly Arabic not-found page for an unknown/inactive slug.

### `/[tutorSlug]/book` — Booking wizard
Four steps (`BookingWizard` + `Step1PersonalInfo`/`Step2Grade`/`Step3Group`/`Step4Payment`):
1. Student name (must be 3+ words), student phone, guardian phone (must differ from student's)
2. Grade selection
3. Group selection (live remaining-seat count per group)
4. Payment method: card / wallet / Fawry / reserve without paying

Submission calls the `create_booking` RPC (capacity-checked, row-locked to prevent overselling the last seat), then either redirects into the Paymob iframe (card), the Paymob wallet redirect, generates a Fawry reference number, or — for reserve-only — goes straight to a booking-details success page.

### `/[tutorSlug]/booking/[code]` — Booking details / retry payment
Looks up a booking by its human-readable code (`BK-<year>-<seq>`). Shows status, group/schedule, and — if payment never completed — a "retry payment" button that re-initiates the same Paymob flow without creating a new booking.

### `/[tutorSlug]/monthly` — Account statement ("كشف الحساب")
Student looks up their booking by code or phone, then sees:
- A summary header (name, group, schedule)
- Two cards: total months paid + amount (including the initial booking fee, shown as its own labeled line) vs. months remaining + amount due
- A month-by-month list, newest first, each with a paid/unpaid badge; paid months also show the payment date and method (بطاقة/محفظة/فوري/يدوي — the last for admin-marked-paid entries)
- The month range always runs from the student's enrollment month through the tutor's current collection month
- This entire statement is visible even when the tutor has monthly payments toggled off in settings — only the "ادفع" buttons on unpaid months hide in that case
- Can arrive with `?phone=...` pre-filled (e.g. from "حسابي")

### `/[tutorSlug]/payment/result` and `/[tutorSlug]/payment/fawry`
Where Paymob redirects after a card/wallet attempt, or where a Fawry payment reference number is shown. Reads `merchant_order_id` to distinguish a booking-fee payment (`BK-...`) from a monthly-fee payment (`MP-<uuid>`) and shows the correct record's status. The redirect page's displayed status is cosmetic only — the webhook, not this page, is the sole source of truth for whether payment actually succeeded.

### `/my-account` — Cross-tutor "حسابي"
Student enters their phone once and sees, grouped by tutor: tutor name/photo, group/schedule, booking status, and a monthly summary expressed only as counts and month names (e.g. "مدفوع حتى شهر نوفمبر" / "متأخر: أكتوبر ونوفمبر") — **no money amounts appear anywhere on this page** by design. Each tutor card links to that tutor's full statement page (phone pre-filled) where real amounts live. Below that, a combined recent-activity feed across every tutor (booking created / booking paid / monthly fee paid), derived entirely from existing tables — no separate events table.

---

## 4. Admin Panel Pages

Protected under `/admin`, gated by Supabase Auth (`src/proxy.ts` redirects unauthenticated visitors to `/admin/login`). Every page below adapts its content/actions to the caller's role.

### `/admin/login`
Email/password sign-in for tutor, TA, and super admin accounts (all are just rows in `admin_users` tied to a Supabase Auth user).

### `/admin/dashboard` — "لوحة القيادة"
Tutor/super admin only (not in the TA nav). Shows a personalized greeting banner ("أهلاً بيك باشمهندس يوسف" for super admin, "أهلاً بيك مستر <اسم>" for a tutor), paid-student count, total revenue, pending-payment count, current month's collection stats, and a table of bookings per group. All counters exclude archived students.

### `/admin/students` — "طلابي"
The person-centric view. Same grade/group/status/search filters as الحجوزات (query logic shared via `fetchAdminBookings()`, not duplicated). Each student row expands into a full card: contact info, booking status/date, a monthly paid/unpaid strip, the notes thread (with add-note), and quick actions (mark paid / cancel / **حذف الطالب**, the last two hidden for TAs). A "طالب سابق" badge appears on a new booking whose phone matches an archived one under the same tutor, linking to the archived record.

**"الأرشيف" tab** (tutor/super admin only, hidden for TA): lists archived students with who archived them and when; full card (payment history, notes) still viewable; "استعادة" un-archives, blocked with a clear message if the group has no free seat.

### `/admin/bookings` — "الحجوزات"
The original operations view (kept unchanged/working as-is per explicit instruction) — same filters, Excel export button, mark-paid/cancel actions. Read-only for TAs.

### `/admin/monthly-payments`
Per-month matrix of every paid-and-active booking (archived excluded) vs. that month's payment status, with manual mark-as-paid and Excel export.

### `/admin/grades` and `/admin/groups`
CRUD for grade levels and study groups (name, schedule, capacity, price, monthly fee). Read-only for TAs. Super admin gets a tutor picker to manage any tutor's grades/groups without switching into them.

### `/admin/settings`
Toggle whether new bookings are open, whether monthly payments are open, and which month is the "current" collection month.

### `/admin/tas` — "المساعدون"
Lists TAs. Super admin creates TA accounts directly (name, email, password, and a multi-select of which tutor(s) they can work with) or via approving a request. A TA linked to more than one tutor gets a switcher in the header to pick which tutor's data they're currently viewing — read-only that scoping is enforced by RLS, not just the UI.

**"طلبات المساعدين" panel** (embedded in the same page, super admin only): pending TA requests from tutors, each with "قبول" (opens the same TA-creation form pre-filled with the request's name/email/tutor, super admin only sets a password) or "رفض" (optional reason shown to the tutor). Tutors see their own request history with status badges on this same page.

### `/admin/tutors` — "المدرّسون" (super admin only)
Lists every tutor with an "إدارة هذا المدرّس" (switch into) and activate/deactivate toggle, plus a form to create a brand-new tutor (name, slug, phone, login email/password).

### `/admin/tutors/[tutorId]` — Tutor profile (super admin only)
- Basic info: name, slug, phone
- Photo upload (Supabase Storage, public bucket `tutor-photos`)
- Login email (changes both `auth.users` and the denormalized `admin_users.email`)
- Password reset: generates a new random password shown once on screen — genuinely cannot be "viewed" afterward, since Supabase Auth stores only the hash
- Bank account details (bank name, account holder, account number) — informational, never shown publicly
- **Paymob credentials**: API key, HMAC secret, card/wallet/Fawry integration IDs, iframe ID — with a show/hide toggle for the two secret fields. This is the only way to configure a tutor's payment processing; there is no other UI for it.

### Notifications bell
Present for tutors/super admins. Two kinds of notifications share one generalized table: a new student note (with excerpt/context), and TA-request lifecycle events (submitted → notifies every super admin; approved/rejected → notifies the requesting tutor).

---

## 5. Database

### Tables (11, confirmed live via the Supabase REST schema)

| Table | Purpose | Key columns |
|---|---|---|
| `tutors` | One row per tenant | `slug` (public URL), `is_active`, `photo_url`, `bank_*`, `paymob_api_key`, `paymob_hmac_secret`, `paymob_card_integration_id`, `paymob_wallet_integration_id`, `paymob_fawry_integration_id`, `paymob_iframe_id` |
| `admin_users` | Login accounts (tutor/TA/super admin), 1:1 with a Supabase Auth user | `tutor_id` (the tutor this admin is *currently* acting as — reused for both super admin's "switch into" and a multi-tutor TA's active selection), `role`, `is_active`, `email`, `name` |
| `grades` | Grade levels per tutor | `display_order`, `is_active`, `tutor_id` |
| `groups` | Study groups per grade | `days`, `time`, `capacity`, `price`, `monthly_fee`, `tutor_id` |
| `bookings` | The core student record — one per enrollment | `booking_code`, `student_name/phone`, `guardian_phone`, `payment_method`, `payment_status`, `amount`, `paymob_order_id`, `expires_at` (48h reserve-only hold), `archived_at`, `archived_by` |
| `monthly_payments` | One row per (booking, month) — unique constraint makes double-paying structurally impossible | `month` (`'YYYY-MM'`), `amount`, `payment_method`, `payment_status`, `paymob_order_id`, `paid_at` |
| `settings` | One row per tutor | `booking_open`, `monthly_payment_open`, `current_month` |
| `student_notes` | Free-text notes on a booking | `created_by` (admin_users id), `note` |
| `notifications` | Generalized bell notifications | `type` (`student_note` / `ta_request_submitted` / `ta_request_resolved`), `recipient_admin_id`, `message`, booking-specific columns (nullable, used only for the student_note type) |
| `ta_requests` | Tutor's formal request queue for a new assistant | `status` (`pending`/`approved`/`rejected`), `admin_note`, `resolved_at` |
| `ta_tutor_links` | Junction table: which tutors a TA may switch between | `ta_id`, `tutor_id` |

### RPC functions (22, confirmed live)

**Public/anon-facing (all `SECURITY DEFINER`, since anon has no direct table access to `bookings`):**
`create_booking`, `get_groups_with_availability`, `get_booking_by_code`, `get_tutor_by_slug`, `list_active_tutors`, `find_eligible_bookings`, `find_active_reservation`, `start_reservation_payment`, `pay_monthly_fee`, `get_monthly_payment_status`, `get_monthly_payment_by_id`, `get_account_statement_header`, `find_student_bookings_across_tutors`, `get_student_recent_activity`, `expire_stale_reservations`, `generate_booking_code`

**Admin-facing:**
`get_monthly_payment_matrix` (runs with caller's own RLS-scoped privileges, not SECURITY DEFINER — a tutor/TA naturally sees only their own rows), `create_student_note` (fans out notifications atomically), `restore_booking` (capacity-checked un-archive, role-checked internally), `ta_can_switch_to_tutor`, `admin_has_tutor_access`, `is_tutor_active`

### Security-definer hard invariants (triggers, not RLS)

Two `BEFORE UPDATE` triggers on `admin_users`, added after a real privilege-escalation bug was found (see Sections 7–8):
- `admin_users_role_immutable` — `role` can never change via UPDATE, full stop (service_role exempted for legitimate backend operations).
- `admin_users_tutor_id_change_guard` — if a `'ta'` row's `tutor_id` is changing, the new value must already be one of that TA's own `ta_tutor_links` rows, or the update is rejected.

These exist specifically because RLS policy composition (Postgres ORs together every applicable policy's WITH CHECK, regardless of which policy's USING clause made the row visible) proved too easy to get subtly wrong twice in a row — the triggers are a second, independent, un-bypassable layer.

### RLS strategy in plain language

- **Public/anon** has no direct SELECT/INSERT/UPDATE on `bookings`, `monthly_payments`, `tutors`, or `admin_users` at all — every public read or write goes through a `SECURITY DEFINER` function that validates business rules explicitly (capacity, ownership, status) before touching a row. `grades`/`groups` grant anon a narrow SELECT (active rows of active tutors only, via the `is_tutor_active()` helper to avoid a subquery into a table anon can't see).
- **Authenticated tutor/super_admin** get a single `FOR ALL` policy per table keyed on `admin_has_tutor_access(tutor_id, ['tutor','super_admin'])` — a `SECURITY DEFINER` helper that returns true for a super admin regardless of which tutor_id, or for a tutor only when it matches their own. This one helper is reused everywhere specifically to avoid the infinite-recursion bug described in Section 7.
- **TA** gets separate, narrower SELECT-only policies (`admin_has_tutor_access(tutor_id, ['ta'])`) on grades/groups/bookings/monthly_payments — never a write policy on any of those tables. `student_notes` is the one exception where TAs get read access alongside a note-creation path (via the RPC), matching their designed "read-only but can flag things" role.
- **Archiving** required no new RLS at all — it's a plain UPDATE already covered by the tutor/super_admin's existing FOR ALL policy; TAs simply have no UPDATE policy on `bookings` to begin with.

---

## 6. Payment System

### Per-tutor credentials design
Paymob credentials (`api_key`, `hmac_secret`, three integration IDs, one iframe ID) live as columns on the `tutors` table — never in environment variables, never shared across tutors. `getTutorPaymobCredentials(tutorId)` fetches them server-side via the service-role client. The super admin edits them through the tutor profile page's "بيانات الدفع (Paymob)" section.

### Initial booking payment flow
1. Student submits the booking wizard → `create_booking` RPC inserts a `pending` booking row and returns `booking_code` + `amount` + `tutor_id`.
2. Server action calls `initiatePayment()`: Paymob `auth/tokens` → `ecommerce/orders` (with `merchant_order_id` = the booking_code) → `acceptance/payment_keys` (with the tutor's card/wallet/Fawry integration ID) → for card, builds an iframe URL with the tutor's `iframe_id`; for wallet, calls `payments/pay` with `subtype: WALLET` and gets a redirect URL; for Fawry, calls `payments/pay` with `subtype: AGGREGATOR` and gets a bill reference number.
3. Student completes payment (or gets a Fawry reference to pay at a kiosk).
4. Paymob calls the webhook (`/api/webhooks/paymob`) with the transaction result and an HMAC signature.
5. Webhook resolves which booking the `merchant_order_id` belongs to, fetches THAT tutor's HMAC secret, verifies the signature, and — only if valid and `success: true` — flips `payment_status` to `'paid'` and stamps `paid_at`/`paymob_order_id`. The client-side redirect page never sets payment status itself; the webhook is the only source of truth.

### Monthly payment flow
Same shape, but `merchant_order_id` is `"MP-" + monthly_payments.id` instead of a booking code, so the webhook can tell the two apart (`resolveBooking` vs `resolveMonthlyPayment`) and verify/update the correct table. `pay_monthly_fee` RPC creates or reuses a pending `monthly_payments` row (unique `(booking_id, month)` constraint makes double-paying structurally impossible, not just an app-level check).

### What's configured vs. still pending
- `mr-yousef` (the real live tutor) has all four Paymob values set and **card payments have been verified end-to-end with a real test-mode transaction through the live webhook**.
- The Paymob merchant account is still **in Test/Sandbox mode** (`is_live: false`, dashboard shows "In the Onboarding Process"). Card payments work in this mode because Paymob provides official test card numbers; **wallet and Fawry payments were tested and genuinely fail** in this mode (Fawry returns an explicit error, wallet returns no redirect URL) — this needs either official Paymob test credentials for those two methods, or completing the merchant's business verification with Paymob to go fully live.
- `me-abdalla` (second tutor) has no Paymob credentials configured yet and is currently inactive.

---

## 7. Bugs Found & Fixed (chronological)

1. **Ambiguous column references in `create_booking`** — `RETURNS TABLE(id, ...)` shadowed bare `id`/`expires_at` references inside the function body. Fixed by fully qualifying every column with its table name (migration `0004`).
2. **RLS blocked anon reads of grades/groups for active tutors** — the policy's `exists (select 1 from tutors ...)` subquery ran as anon, which has zero visibility into `tutors` (by design, to protect Paymob secrets), so it always failed. Fixed with an `is_tutor_active()` SECURITY DEFINER helper (migration `0006`).
3. **Infinite recursion in `admin_users` RLS (error 42P17)** — a self-referencing policy on `admin_users` broke every authenticated query app-wide. Fixed by routing every such check through `admin_has_tutor_access()`, a SECURITY DEFINER function whose internal lookup bypasses RLS (migration `0011`).
4. **Notes misattribution risk** — `StudentNotes` was receiving one table-wide `tutorId` prop instead of each row's own `tutor_id`, which would have silently misattributed notes once a super admin viewed bookings across multiple tutors. Fixed before it shipped.
5. **Monthly-payment result page always showed "not found"** — it only ever looked up bookings by `booking_code`, but a monthly fee's Paymob order carries `merchant_order_id = "MP-<id>"`, which never matches. Traced the whole webhook chain first (confirmed the webhook itself was working correctly by replaying a signed payload) before finding the actual bug was purely in the result page. Fixed with a new `get_monthly_payment_by_id` RPC and branching logic (migration `0014`).
6. **Duplicate reservation bug** — `find_eligible_bookings` only ever matched `payment_status = 'paid'`, so a student with an active unpaid "reserve without paying" hold was invisible to the phone-first lookup and always fell through to "book again," creating duplicate seat holds. Fixed with `find_active_reservation` + a new "existing reservation" UI step (migration `0015`).
7. **Privilege escalation in multi-tutor TA switching (security bug, found via live testing)** — a TA could PATCH their own `admin_users` row to switch to a tutor they weren't linked to, or even escalate straight to `role = 'super_admin'`. Root cause: Postgres ORs together every applicable permissive policy's WITH CHECK clause for a command, independent of which policy's USING clause made the row visible — two older, weaker WITH CHECK clauses became live escape hatches once a third (TA-switching) policy existed. First fix attempt (tightening the WITH CHECK clauses, migration `0018`) turned out to still be insufficient, since WITH CHECK only inspects the attacker-controlled NEW row. Final fix replaced reliance on RLS policy composition with two hard `BEFORE UPDATE` triggers comparing against the real persisted OLD row (migration `0019`) — verified live that both exploits now fail and legitimate switching/toggling still works.
8. **Homepage served stale tutor list** — Next.js had statically prerendered `/` at build time (no dynamic params triggered automatic static optimization), so the tutor directory kept showing already-deleted tutors after a full data reset. Fixed with `export const dynamic = "force-dynamic"`.
9. **`UNION ALL` column reference in `get_student_recent_activity`** — `ORDER BY event_date` failed because Postgres derives a UNION's output column names only from the first branch; fixed by adding explicit aliases to the first SELECT.
10. **Shell-argument Arabic text corruption** — renaming a tutor via a `curl` PATCH with the Arabic name as a literal shell argument silently mojibake'd it into literal `?` characters in the actual stored database value (not just a terminal display issue). Fixed by sending the payload from a UTF-8 file via `--data-binary` instead of an inline shell argument.
11. **False-positive ESLint rule (`react-hooks/immutability`)** flagged a `window.location.href` assignment in `PhoneFirstEntry.tsx` inside a ternary-derived variable, while three other files with an identical pattern passed clean. Root-caused to the ternary shape (not the assignment itself) and fixed by extracting the redirect into a module-level helper function.

---

## 8. Security Measures

- **HMAC-SHA512 webhook verification**: every Paymob webhook call is verified against the exact field-order concatenation Paymob's docs specify, using `crypto.timingSafeEqual` (not a plain `===`) to avoid timing attacks, and — critically — using the *specific tutor's own* HMAC secret (resolved from the transaction's `merchant_order_id` first), never a global one.
- **Row Level Security everywhere**: every table with sensitive data has RLS enabled; anon has no direct table access to `bookings`/`monthly_payments`/`admin_users`/`tutors`, only narrow SECURITY DEFINER RPCs.
- **SECURITY DEFINER used deliberately, not carelessly**: only to bypass RLS for a specific, narrow, explicitly-validated purpose (e.g., `admin_has_tutor_access` bypassing RLS internally to avoid the exact recursion bug described in Section 7) — never as a blanket "run as superuser."
- **Anti-privilege-escalation triggers**: `admin_users.role` is immutable via UPDATE; a TA's `tutor_id` can only ever change to one of their own linked tutors — enforced independently of RLS policy composition (see Section 7, bug #7).
- **Password policy**: minimum 8 characters enforced both client and server-side; passwords are hashed by Supabase Auth and genuinely cannot be displayed after creation — only reset (a fresh, randomly-generated password shown once on screen, never stored in application state or logs).
- **Secrets isolation**: `SUPABASE_SERVICE_ROLE_KEY` only ever imported in server-only files (`src/lib/supabase/service.ts`, marked with the `server-only` package so a client-bundle import fails at build time); Paymob secrets live in the database, never in `.env` files or client-visible code; `.env.local` is git-ignored.
- **Input validation**: every server action validates its input with a Zod schema before touching the database (phone number format, name word-count, email format, password length, etc.) — defense in depth alongside RLS/DB constraints.
- **Concurrency-safe seat counting**: `create_booking` and `restore_booking` both `SELECT ... FOR UPDATE` the group row before counting active bookings, so two simultaneous requests for the last seat can never both succeed.
- **Verified empirically, not assumed**: RLS/permission boundaries throughout this project were checked via direct signed REST calls as each role (tutor, TA, super admin) attempting both allowed and forbidden operations — not just "the UI hides the button."

---

## 9. Pending / Known Limitations

- **Paymob account still in Sandbox/Test mode** — wallet and Fawry payments do not currently work in real testing (see Section 6). Needs either official Paymob test credentials for those two methods, or completing Paymob's business verification to flip the account to Live.
- **Second tutor (`me-abdalla`) has no Paymob credentials configured** and is currently deactivated — presumably mid-onboarding.
- **No automated test suite** — correctness has been verified throughout development via live database checks and manual UI walkthroughs, not unit/integration tests.
- **No WhatsApp integration is built** — links intended for WhatsApp sharing (e.g. a tutor sending a student their statement link) are plain URLs; there's no automated WhatsApp message sending anywhere in the system.
- **`scripts/reset-all-data.sql`** exists for a full pre-handover wipe but has not been run since the current round of feature development — running it is a deliberate, manual, confirmed-in-advance action, not something automatic.
- **README.md is stale** — it still documents an older Paymob-credentials-via-environment-variables setup, superseded by the per-tutor database-stored credentials design; it has not been rewritten to match current state.
- **No rate limiting / CAPTCHA** on the public booking or phone-lookup endpoints.
- **Old duplicate Vercel project** — a stale second Vercel project from an early setup attempt was flagged during deployment; confirmed deleted at the time, worth a quick re-check before final handover.

---

## 10. File Structure

```
src/
  app/
    page.tsx                          Root: public tutor directory ("حسابي" link in header)
    layout.tsx                        Root layout
    my-account/                       Cross-tutor "حسابي" (public)
      page.tsx, actions.ts
    [tutorSlug]/                       Everything under a specific tutor's public site
      page.tsx                        Tutor landing (phone-first entry)
      not-found.tsx                   Arabic 404 for unknown/inactive slug
      book/                           Booking wizard
        page.tsx, actions.ts, reservation-actions.ts
      booking/[code]/page.tsx         Booking details / retry payment
      monthly/                        Account statement ("كشف الحساب")
        page.tsx, actions.ts
      payment/
        result/page.tsx               Post-Paymob-redirect status page
        fawry/page.tsx                Fawry bill reference display
    admin/
      (auth)/login/page.tsx           Admin/tutor/TA login
      (protected)/                    Everything behind auth (proxy.ts gate)
        layout.tsx                    Nav, role-aware greeting banners, TA tutor switcher
        dashboard/page.tsx            لوحة القيادة
        students/                     طلابي (+ الأرشيف tab)
          page.tsx, actions.ts
        bookings/                     الحجوزات (operations view, unchanged)
          page.tsx, actions.ts
        monthly-payments/page.tsx, actions.ts
        grades/, groups/              CRUD pages + actions
        settings/page.tsx, actions.ts
        tas/                          المساعدون + طلبات المساعدين
          page.tsx, actions.ts, requests-actions.ts
        tutors/                       المدرّسون (super admin only)
          page.tsx, actions.ts
          [tutorId]/page.tsx          Tutor profile (incl. Paymob credentials editor)
        notifications/actions.ts
    api/
      webhooks/paymob/route.ts        Paymob webhook receiver (HMAC-verified)
      admin/export/route.ts           Bookings → Excel
      admin/export-monthly/route.ts   Monthly payments → Excel
  components/
    booking/                          4-step booking wizard components
    monthly/MonthlyFlow.tsx           Account statement UI (lookup → statement)
    my-account/MyAccountView.tsx      حسابي UI
    tutor/                            PhoneFirstEntry, AdminFooterLink
    admin/                            All admin panel components (one per manager/table/panel)
    ui/Button.tsx                     Shared button component
  lib/
    supabase/                         server.ts (anon), admin-server.ts (cookie-auth), service.ts (service-role), browser.ts
    paymob/                           client.ts (API calls), hmac.ts (signature verify), initiate-payment.ts
    auth/                             current-admin.ts, resolve-write-tutor.ts, admin-actions.ts
    booking/                          get-booking.ts, retry-payment.ts, labels.ts
    monthly/get-monthly-payment.ts
    admin/fetch-bookings.ts           Shared query logic for الحجوزات + طلابي
    tutor/                            resolve-tutor.ts, get-tutor-credentials.ts
    excel/                            build-workbook.ts, build-monthly-workbook.ts
    validation/booking.ts             Zod schemas
    utils/format-month.ts
  types/                              booking.ts, monthly.ts
  proxy.ts                            Auth-gate middleware for /admin/*
supabase/
  migrations/                        24 files, 0001 through 0024, applied in order via SQL Editor
scripts/
  reset-all-data.sql                 Full data wipe (manual, pre-handover use)
PENDING.md                           Living launch-readiness / open-items note
README.md                            Setup instructions (partially stale, see Section 9)
```
