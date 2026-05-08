# TallyShot — Competitive Research

Single source of truth for what the competition does, where they fail, and
what TallyShot should do differently. Compiled across multiple research
sessions; do not duplicate this work in future passes — extend it.

Last updated: research session 6 (May 2026 — SparkReceipt + Dext verification pass).

---

## Apps studied

| App | Developer | Installs | Rating | Free tier | Paid | Notes |
|---|---|---|---|---|---|---|
| Expensify — Travel & Expense | Expensify Inc. | 1M+ | 4.3★ (31k) | 25 SmartScans/mo | $5–$36/seat/mo | Enterprise-leaning; corporate cards, accounting integrations |
| Receipt Scanner: Easy Expense | Easy Expense Tracker | 1M+ | 4.6★ (18.3k) | 10 scans/mo | $6–$7/mo | Self-employed / freelancer focus |
| Crunchr Receipt Scanner | Crunchr Technologies | 5k+ | 4.9★ Capterra | 7-day trial, no card | $4.99/mo or $76.90/yr | "Best Mobile App 2023" winner; AU-based; dark + teal aesthetic |
| Receipt & Expense Tracker | Saldo Apps | 100k+ | 4.3★ (2.87k) | 10 scans (period varies) | $10/wk or $100/yr | Aggressive paywall; dark green branding |
| SparkReceipt: Expense Scanner | SparkReceipt Oy | 10k+ | 4.7★ (1.06k Play) | 15 docs/mo, no card, no time limit | Pro $9/mo (100 docs) · Elite $12/mo (500 docs) · lifetime price lock | Finland-based; ChatGPT-powered; **free accountant invite**; hostile cancellation still unresolved (May 2026) |
| Dext: Receipt Tracker | Dext | 500k+ | 4.8★ (11.9k Play) | None — paid only via firms | Bundled into Dext suite (tier-priced) | Xero App Partner of the Year 2024; 700k+ businesses; **GPS mileage tracking** |

---

## A. Expensify (recap from prior research)

**Strengths:** SmartScan via photo/email/SMS; deep accounting integrations (QuickBooks/Xero/NetSuite/Sage); 10k+ bank feeds; mileage with maps; next-day reimbursement; team/admin policy enforcement.

**Top complaints:**
1. SmartScan completes slowly or silently fails — receipts stuck "in process"
2. App crashes when multi-scanning (open GitHub issue #68516)
3. "New UI is less intuitive than the old one"
4. Submit ambiguity (one expense vs whole report)
5. Orphaned receipts can't be deleted
6. Auto-submit fails with daily error emails
7. Concierge auto-replies are generic
8. Pricing complexity / surprise charges
9. Sync produces duplicates
10. No phone support

**Pricing:** Free 25 scans/mo, then $0.20 per overage scan. Collect $5/seat/mo, Control $9–$36/seat/mo.

---

## B. Easy Expense (recap from prior research)

**Strengths:** Fast scan + auto-crop; tax-deductible auto-categorisation; multiple workspaces; offline-first with cloud sync; no ads (called out as a positive).

**Top complaints:**
1. Aggressive paywall after a few scans ("FREE app got expensive quick" — 95 helpfuls)
2. Cannot opt out / select $0 plan after limit hit
3. Subscription nag mid-flow
4. OCR confuses tax for total — silent data corruption
5. OCR confuses month for day-of-week
6. Customer support unreachable
7. Pricing for "free" tier unclear before install
8. CSV bulk import on website is broken
9. Bank reconciliation only works with some banks
10. Custom tags/categories missing

**Pricing:** Free 10 scans/mo + free tracking; ~$6–$7/mo Pro.

---

## C. Crunchr Receipt Scanner — *NEW*

### Visual style
- **Dark theme, teal/cyan accent** (~#00C2B8), with an amber/gold "My Spend" CTA pill
- App icon: white "C" mark on teal background
- Very clean transaction list — each row shows merchant + category + amount + a **pencil edit icon**
- Monthly total at top with a dropdown month selector ("MAY 2022 ▼")
- Marketing tagline: **"Zero to organised in 30 seconds"** (this is *their* speed promise — we should beat it)
- Won "Best Mobile App 2023"
- Australian-based; UI feels premium / consumer-grade rather than enterprise

### Feature inventory
- AI receipt scan with auto-edge detection
- **Multi-receipt batch scan — up to 10 at once** (unique among the four)
- **PDF receipt reader** — extract from e-receipts, not just paper
- AI-powered search across receipt data **and** photos
- Categories with auto-learning ("tell us once and we'll take it from there")
- Custom folders for projects
- Foreign currency support (June 2023)
- **Export to Xero, QuickBooks, MYOB, PDF, Excel** — broadest export of the four
- **Excel exports include the receipt photos themselves**
- iOS + Android + web dashboard (cloud sync via AWS)
- Multi-page receipt support
- Receipt calculator (totals by category/time)

### Free tier & paywall
- **7-day free trial, no credit card required** — most user-friendly trial of the four
- After trial: $4.99/mo or $76.90/yr
- All features in all tiers (no good/better/best ladder)

### Praises (from limited reviews — Capterra 4.9★ over 17 reviews)
1. Truly fast — "zero to organised" tagline rings true
2. AI scanning snappy and accurate
3. Affordable price point
4. Reliable cloud storage
5. Multi-receipt batch scan saves real time
6. Excel exports with receipt photos = great for accountants
7. Web dashboard parity
8. No-credit-card trial reduces friction
9. Active feature roadmap (multi-page, batch, AI search, calculator all 2023)
10. Australian/global availability without forcing US-tax framing

### Complaints
- Email support sometimes unresponsive
- Historical scan failures (claimed fixed)
- Minor Mac OSX glitches
- Small sample size — 17 Capterra reviews, 5k+ installs is modest

### Lesson: visual design
**Crunchr's dark + teal is genuinely premium.** The pencil-edit affordance on every transaction is a small UX win we should steal — users see they can edit without tapping in first. Their amber "My Spend" CTA on a dark surface is exactly the contrast pattern that works.

---

## D. Receipt & Expense Tracker (Saldo Apps) — *NEW*

### Visual style
- **Dark green** app icon, "RECEIPT SCANNER" text in light cream/yellow with red corner badge
- Marketing screens dark green background, light typography
- "Saldo Apps" branded ribbon on every screenshot
- Less polished than Crunchr; functional but feels more spreadsheet than receipt-app

### Feature inventory
- OCR scan: merchant, date, total
- Categories + sub-categories + tags
- Cash + bank accounts as separate buckets
- Budget limits per total / per category
- NetWorth widget
- Income tracking
- 1040 IRS form support (US-tax framed)
- Manual expense entry
- Multi-currency
- **Light + dark themes**
- Report preview before share
- Offline capable
- Line-item description capture **(but cannot export them)**

### Free tier & paywall
- **10 free scans, then a paywall ad pops after the 1st scan**
- "Don't be fooled" review mentions you have to hit X in the top-left to dismiss the upsell modal *every time*
- Subscription: **$10/week or $100/year**
- $10/week is one of the most aggressive prices in the category

### Praises
1. ~80% line-item scanning accuracy (one user)
2. 4.3★ at 100k installs — trusted at scale
3. Manual expense entry without scan
4. Light + dark themes
5. Offline mode works
6. Budget tracking + NetWorth widget
7. Available globally
8. Categories + sub-categories + tags (more granular than competitors)
9. Multi-currency
10. Preview-before-share on reports

### Complaints
1. **Paywall modal after 1st scan** — most-cited complaint
2. **$10/week is jarring** — users expect monthly pricing
3. **GST double-counting in Australia** — adds GST to the total when GST is already inclusive (Australian receipts come with GST already in the total)
4. **Cannot export line items** (captured but locked behind a non-existent feature)
5. Crashes on multi-scan
6. Slow scan in general
7. Sometimes loses all data
8. Tech support slow / silent
9. Underscores in email addresses break signup
10. No income/budget tracking despite menu suggesting it

### Lesson: regional tax + line items
Saldo's biggest functional flaw is **double-counting tax in inclusive-tax regions**. UK VAT, AU GST, NZ GST, and most EU VAT receipts have tax *already in the total*. Adding it again gives a wrong total. This is the most-cited 1–3★ pattern across the entire category — not just Saldo. **TallyShot must get this right.**

Their second-biggest flaw: capturing line items but never exporting them. **A receipt scanner that doesn't export line items is half-built.**

---

## E. SparkReceipt: Expense Scanner — *NEW*

### About the company
- **Developer:** SparkReceipt Oy (Finland-based)
- **Play Store:** 4.7★ from ~1.06k reviews; 10k+ installs (mobile is a small slice — they're a web-first SaaS)
- **AppSumo:** 4.8★ from 179 reviews (lifetime deal driving most reviews)
- **Available since 2022;** ChatGPT-powered AI from launch

### Visual style
- Light primary palette with a warm orange/amber accent on CTAs and brand mark
- Web-first design — mobile app feels like a viewer onto the web product, not a mobile-native experience
- Cleanly tabular receipt list; PDF/document-centric layout (handles invoices and statements alongside receipts)

### Feature inventory
- AI receipt scan (vendor / total / date / tax / currency / line items, claimed 2–3 sec per receipt)
- Email receipt forwarding **and** automatic Gmail / Outlook / IMAP import
- **Bank/credit card statement upload** (PDF, Excel, CSV) — extracts every transaction and matches to existing receipts
- Invoice scanning (vendor invoices, not just till receipts)
- Multi-currency: 150+ supported, daily FX
- Local tax rules baked in (VAT / GST / PST / HST per receipt's country of origin)
- Line-item categorisation (each line gets its own category)
- **Free accountant invite — guest seat at no extra cost on every plan**
- Cloud sync; web dashboard is the main surface
- 60-day money-back guarantee on annual plans

### Pricing & free-tier behaviour
- **Free plan:** 15 documents/month, no credit card, **no time limit**
- **Pro:** $9/month or $79/year (effective $6.58/month); lifetime price lock — your price never goes up even when features are added
- All paid plans include the accountant guest seat
- Refunds are *not* automated — must email support within 60 days

### Top praise themes
1. **"Invite your accountant for free"** — the headline differentiator; reviewers repeat the phrase nearly verbatim
2. Fast, friendly support (small team, EU-time-zone responsiveness shows up in reviews)
3. Lifetime price lock is read as honest pricing
4. Decent value for solo founders / freelancers vs. Expensify / Dext seat pricing
5. Email + IMAP import means digital receipts capture themselves
6. Receipt + invoice + statement in one app (the "pre-accounting" framing)
7. Multi-currency works without surprise edge cases

### Top complaints (1–3★ themes from recent reviews)
1. **Cancellation flow is hostile** — "downgrade" routes to billing, billing only cancels the *next* bill, no self-service refund. (Joseph Wong, Jan 2026, and matching Trustpilot complaints — confirmed.) This pattern alone destroys trust even when users like the product.
2. **Default scan filters cause OCR errors** — switching to a "straight photo" / no-filter mode improves results. The default filter aggressively de-skews and contrast-boosts, which can mangle thermal-paper receipts. (Peter Hawthorne, Feb 2026 — confirmed pattern; SparkReceipt's site doesn't currently expose this toggle.)
3. **Top-tier subscription line-item extraction is buggy** — paying users still see line items split incorrectly or missed; users would prefer a simple net / VAT / gross summary as a fallback when line-items can't be reliably parsed. (Peter Hawthorne, Feb 2026.)
4. Currency conversion sometimes wrong on the cusp of a daily FX update
5. Bank-statement importer occasionally mis-reads PDFs from less-common banks
6. Email importer can stall silently when an inbox throws up rate limits
7. Refund process feels manual and slow vs. App Store / Play Store direct refunds

### Lesson: an accountant seat at no extra cost is the strongest single differentiator we've seen
SparkReceipt's #1 mentioned feature in reviews is *not* their AI — it's that the accountant joins for free with a live read-only view of everything. Crunchr / Easy Expense / Saldo do not match this. **Borrowing this for v1.1 is an obvious win for TallyShot's small-business audience.**

### Lesson: do not repeat their cancellation mistake
A single hostile cancellation pattern is enough to turn a 5★ product review into a public 1★ warning. The fix is trivial — a "Cancel subscription" button that goes straight to the platform's own subscription manager — but you have to actively choose to do it. **TallyShot will.**

### Lesson: photo-mode default
Fancy filters are *fine* but should be opt-in. A "raw photo" default is what reviewers tell us they end up using anyway, and it sidesteps a class of OCR errors we'd otherwise own.

### Lesson: net / VAT / gross fallback
Line-item extraction is a stretch for any AI on a wrinkled thermal-paper receipt. When it fails, falling back to the **three numbers users actually need to file** (net, tax, gross) is a graceful degradation. We already have these — we just need a display mode that shows them prominently.

---

## F. Dext: Receipt Tracker — *NEW*

### About the company
- **Developer:** Dext (London-based, formerly Receipt Bank, rebranded 2020)
- **Play Store:** 4.8★ from ~11.9k reviews; **500k+ installs**; Trustpilot 4.7★; App Store 4.8★
- **Customer base:** 700k+ businesses, 12k+ accounting firms worldwide
- **Awards:** Xero App Partner of the Year (UK & US, 2024) — this is the "small business app of the year" reference; QuickBooks Developer Spotlight 2024
- The mobile app is **paid-only** — there is no free tier on the consumer side; users come in via their accountant or firm subscription

### Visual style
- Light theme with deep blue (`#0033a0`-ish) primary and white surfaces — *very* enterprise / B2B
- Dense data tables; everything is a list of documents with status
- "Inbox → Costs → Sales" workflow framing borrowed from email
- Clean capture screen; the rest of the app is structured around accountant workflows, not consumer scanning
- **Status pills on every document** — a consistent visual pattern we should copy: pending / processing / ready / submitted

### Feature inventory
- AI receipt scan (claims 99% extraction accuracy across vendor / amount / tax)
- Invoice extraction (separate flow; vendor invoices not just till receipts)
- Bulk upload from camera roll
- Email-forward inbox per user (`<unique>@dext.com`)
- **GPS mileage tracking** — round-trip toggle, distance, business purpose, claim category
- "Vault" — secure long-term storage for processed documents
- **Submit workflow:** Collect → Edit → Submit → status (Submitted / Approved / Rejected)
- Two-way accounting sync: QuickBooks, Xero, Sage, FreeAgent, KashFlow, AccountsIQ
- Search across receipts including OCR text
- Per-client folders for accountants (multi-entity)
- Mobile app + web dashboard parity

### Pricing & free-tier behaviour
- **No standalone consumer free tier.** App is bundled into a Dext subscription which firms buy on tiers; small-business stand-alone pricing starts ~$24/user/month per third-party comparison sites
- This is a *big* gap for solo freelancers — Dext is too expensive unless your accountant already pays for it
- A 14-day free trial exists on the firm tier

### Top praise themes
1. **Reliable at scale** — accountants with 100+ clients use it daily; this is a 4.8★ for sustained reliability, not novelty
2. **Accounting-software sync just works** — single-click two-way Xero/QBO mapping is the killer feature for the firm audience
3. Mileage tracking is loved by reps and tradespeople
4. Email-forward inbox handles digital receipts without thought
5. Bulk-scan workflow on the mobile app keeps up with a stack of paper receipts
6. **Submit workflow + status pills** make it obvious what stage a receipt is at — never "did this get sent?"
7. The accountant-side experience (Dext Prepare) is best-in-class

### Top complaints (lessons stand even on older reviews)
1. **Silent upload failures.** "Receipts take hours to load and sometimes don't load at all — you would never know unless you double-checked." This is *the* recurring complaint and the one most directly relevant to TallyShot's "never lose a receipt" promise. *Always show sync status. Never fail silently. Always allow retry.*
2. **Cannot edit invoice number** — extracted field is locked; users have to delete + re-upload to fix a typo. Lesson: **every extracted field must be editable.**
3. **Cannot access archived receipts.** Once moved to Vault / Archive there's no obvious way back. Lesson: **archived view is mandatory; restore button per item.**
4. **Reports don't organise by date** — users have to sort manually each time. Lesson: sensible default sort + remembered preference.
5. **Cannot move a receipt between reports** — once it's in Report A you're stuck with it. Lesson: receipts ↔ reports is a many-to-many relation in users' minds.
6. Email-forward sometimes doesn't read receipts whose body is an image attachment
7. Pricing is opaque on the firm side — small businesses can't easily check what they'd pay

### Lesson: visible sync status on every document
Dext's #1 functional complaint is that uploads can fail silently. Their UI *has* status pills but the failure state isn't surfaced loudly enough to interrupt the user. **TallyShot's answer:** every receipt card shows pending / syncing / synced / failed, and a failed one nudges a banner on the home screen until the user resolves it. The photo is always preserved locally so retry is one tap.

### Lesson: every extracted field is editable
"AI got it 99% right but the 1% is locked" is worse than "AI is sometimes wrong and I can fix it." Dext shipped without inline-editable invoice numbers and got dragged for years. TallyShot makes everything tap-to-edit; long-press fires "this extraction was wrong" feedback for our fine-tuning pile.

### Lesson: archived receipts are not deleted
Soft-deleted receipts must be viewable, searchable, and restorable. **Settings → Archived Receipts.** No exceptions.

### Lesson: mileage tracking is a real differentiator for small business
Dext's GPS mileage is loved by reviewers. Crunchr / Saldo / Easy Expense / SparkReceipt don't match it. For TallyShot's freelancer / small-business audience this is a strong v1.1 candidate — manual entry first (start, end, distance, purpose, round-trip), GPS-tracked trips after.

### Lesson: submit workflow + status pills
Status pills on every receipt card (Draft / Submitted / Approved / Rejected) are how Dext makes a multi-actor workflow legible. Even if v1 doesn't ship a manager/accountant approver flow, the *status pill component* should be designed to extend later. Don't paint yourself into a "complete vs. needs-review" two-state corner.

---

## G. Lessons for TallyShot — consolidated across all six

### 1. The "lost receipt" trap is universal
Every app — Expensify, Easy Expense, Saldo — has reviews about scans vanishing into "in process" purgatory. Crunchr is the exception, partly because they upload immediately and partly because their batch flow keeps the user in control.

**TallyShot already wins here:** our needs-review queue + always-recoverable photo + retry button is the strongest implementation in the category. Don't lose this. *Document it in the store listing.*

### 2. Line-item extraction + export is the single biggest unmet need
- Saldo captures items but won't export them
- Easy Expense doesn't extract them well
- Expensify only does it on premium tiers
- Crunchr's Excel export *includes photos* but not structured line items

**TallyShot opportunity:** extract line items reliably (Claude Vision is excellent at this — we already do it but don't expose them) and export them in **both** CSV (one row per line item with a receipt-id column) and PDF (within each receipt section).

### 3. Region-aware tax — non-negotiable
The single most painful "wrong number saved" pattern in the entire category:
- **UK VAT 20% inclusive** — `total` already includes tax
- **AU/NZ GST 10% / 15% inclusive** — `total` already includes tax
- **EU VAT** — varies, mostly inclusive
- **US sales tax** — exclusive (added on top)
- **Canada GST/PST** — varies by province

**TallyShot fix:** add a "Tax mode" setting (Inclusive vs Exclusive vs Auto-detect), default by phone locale (en-GB → Inclusive, en-US → Exclusive), and apply it consistently. AI extraction should report the receipt's apparent mode and the user's setting should override only when it differs.

### 4. Transparent pricing wins reviews
The two most aggressive paywalls (Easy Expense, Saldo) have the lowest 1★ ratings on this exact issue. Users hate:
- Modal upsell *after* using the app once
- "Free" claims that aren't true
- Per-week subscriptions
- Inability to dismiss upsells

The two best-reviewed paywalls (Crunchr, Easy Expense's "no ads" promise):
- 7-day full-feature trial, no credit card
- Clear monthly/yearly only
- Limit shown upfront in onboarding
- Manual entry stays free forever

**TallyShot rule:** the AI quota is the *only* gated feature. Manual entry, list, search, filter, CSV export, PDF export are all free forever. The quota counter is visible in Settings before the user even hits it. **No modal upsell ever.**

### 5. Some users want one-time purchase
Saldo reviews include "I'd rather pay a decent price for the app than recurring subscription" (50 helpfuls). Crunchr offers an annual price ($76.90/yr) that's effectively a one-time-feeling commitment for many users.

**TallyShot consideration:** offer annual heavily discounted vs monthly (e.g. £4.99/mo or £29.99/yr — 50% saving), and consider a "Lifetime" tier (£59.99 one-time) to cover the audience that won't subscribe. This is uncommon in the category and would be a differentiator.

### 6. Visual design — go dark, lean premium
Of the four, the two best-looking apps are **Crunchr (dark + teal)** and **Easy Expense (dark + amber)**. The two worst-looking are **Saldo (dark green, dated)** and **Expensify (light, cluttered)**. Dark wins. Premium accents win.

**Three palette options for TallyShot to choose from:**
1. **Crunchr-style** — `bg #0d1117`, `surface #1c2128`, `accent #14b8a6` (teal), `cta #f5a623` (amber). Most premium.
2. **Apple Wallet style** — `bg #000000`, `surface #1c1c1e`, `accent #ffd60a` (amber/yellow), `cta #ffffff`. Cleanest.
3. **Linear style** — `bg #0a0a0a`, `surface #161618`, `accent #6366f1` (indigo), `cta #f5a623` (amber). Most distinctive.

### 7. Quick wins from competitor UX
- **Pencil-edit affordance per row** (Crunchr) — users see they can edit without tapping in
- **Monthly total dropdown selector** (Crunchr) — better than ours
- **Multi-receipt batch scan** (Crunchr only) — high impact, requires only sequential calls
- **Auto-edge detection** (Easy Expense, Crunchr) — current TallyShot doesn't crop. **Worth adding.**
- **Email-forward receipts** (Expensify, Crunchr Pro) — defer to v2 (needs backend)
- **Web dashboard** (Expensify, Crunchr) — defer to Phase B (cloud sync prerequisite)

### 8. Onboarding — match Crunchr's promise, beat their time
Crunchr's tagline is "Zero to organised in 30 seconds". Our v1 onboarding is currently 3 generic intro screens then permissions. Better: skip-able intro, then *immediately* present a sample receipt scan demo, then *ask* for region/tax mode, then done. Target: under 30 seconds, then they're scanning.

---

## H. What this changes for TallyShot — net new since session 4

The four older competitors gave us the design language (dark + premium accents),
the line-items mandate, and the region-aware tax requirement. SparkReceipt and
Dext add five concrete, mostly *trust-building* changes:

1. **One-tap, honest cancellation is now a v1 blocker.** SparkReceipt's
   "downgrade routes to billing, billing only cancels next bill" is the kind of
   review that destroys a star rating in a weekend. Settings → Subscription →
   "Cancel subscription" goes straight to Google Play's subscription manager
   for our SKU. No retention modal. No guilt screen.
2. **Visible sync / processing status on every receipt is a v1 blocker.**
   Dext's silent upload failures are their most-cited complaint. TallyShot ships
   pending / syncing / synced / failed pills on every card from day one. Failed
   receipts are loud, retryable, and never lose their photo.
3. **Every extracted field is editable, including invoice number.** Dext shipped
   without this for years and is still being dragged for it in 2026 reviews.
   Tap-to-edit on every field; long-press fires "this extraction was wrong"
   feedback for our future fine-tuning data.
4. **Photo capture defaults to "raw" / no-filter.** SparkReceipt's reviewers
   prove the case: aggressive de-skew/contrast filters on by default cause more
   OCR errors than they fix on thermal-paper receipts. Our enhanced mode is
   opt-in and remembered.
5. **Net / VAT / gross summary mode** in addition to line items. SparkReceipt
   reviewer Peter Hawthorne speaks for many small-business users who just want
   the three numbers they need to file. Settings → Display, also accessible
   from the receipt screen.
6. **Archived view is mandatory.** Dext's missing archived view is the kind of
   detail that turns a happy user into a frustrated one the first time they
   need it. Settings → Archived Receipts, with a Restore button per item. We
   already never auto-delete; this just exposes what's already there.

Two strong v1.1 / soon-after-launch candidates also fall out of the new research:

- **Free accountant invite** (SparkReceipt's #1 praise theme). We already have
  a teams feature in Supabase — a read-only "accountant" role on a shared
  workspace, plus an export-everything button, is mostly UI work.
- **Mileage tracking** (Dext's killer feature for small business). Manual entry
  first (start, end, distance, purpose, round-trip toggle); GPS-tracked trips
  after. None of the other five competitors match Dext on this.

Two strong v2 candidates:

- **Accounting-software integrations** (QuickBooks, Xero, Sage, FreeAgent).
  Each is real OAuth + category-mapping work; defer until launch demand
  justifies it.
- **Vendor-invoice extraction** (different OCR profile, different schema).
  Defer — receipts come first.

The full v1 / v1.1 / v2 plan with rationale lives in
[docs/v1.1-roadmap.md](v1.1-roadmap.md) once it exists.

---

## J. Session 6 verification — May 2026

Ran a fresh search pass on 7 May 2026 to confirm the session-5 signals and catch any
changes since then. Nothing in the core analysis has been invalidated; a few things
are worth noting.

### SparkReceipt updates

**New Elite pricing tier.** SparkReceipt now offers three tiers: Free (15 docs/mo),
Pro ($9/mo, 100 docs), and **Elite ($12/mo, 500 docs)**. The elite tier likely targets
small teams and higher-volume freelancers. Our analysis of their pricing as "honest and
simple" holds, but the tier ladder means a solo user who outgrows 100 docs/mo now pays
33% more rather than having unlimited. Worth watching — if Elite users start complaining
about the cap, it reinforces our "unlimited manual entry free forever" angle.

**Hostile cancellation: still unfixed (May 2026).** Reviews posted in 2026 continue to
cite difficulty cancelling and obtaining refunds within the 60-day window. No self-service
cancellation button has shipped. TallyShot's Play-deep-link cancel button (already built
in Slice 6) is still ahead of them.

**Accountant invite: still their #1 praise theme.** Multiple 2026 review aggregators
(G2, AppSumo, GetApp) independently flag it as the top-cited feature. This confirms it
belongs in our v1.1 backlog as a high-priority item, not a "nice-to-have."

**Email import improving.** SparkReceipt's IMAP/Gmail auto-import is noted in recent
reviews as more reliable than before. Not a concern for v1 (we defer email import to
v2), but confirms they are actively investing in the digital-receipt capture space.

### Dext updates

**App actively maintained — v5.4.1 shipped January 2026.** Dext is not stagnant.
Regular updates mean their silent-upload-failure complaint could be addressed any
release; we should not position TallyShot's "never lose a receipt" purely as a
reliability gap vs Dext — frame it as a *philosophy*, not just a current defect they'll
patch.

**Custom mileage rates: "coming soon."** As of May 2026, Dext's mileage tracking uses
only government-approved rates; business-specific reimbursement rates are on their
roadmap but unshipped. This is a tactical gap: TallyShot's v1.1 mileage feature should
ship with a custom-rate field from day one.

**Pricing confirmed unaffordable for solo freelancers.** Business plans start at
$31.50/month for 5 users. A solo freelancer cannot buy a 1-seat plan at a sensible
price — Dext is still locked to the accountant-firm channel. TallyShot's "no account
needed, 10 free scans, trivial Pro price" message remains our clearest competitive
advantage against Dext.

**Silent upload failures: still cited in 2026.** The complaint from session 5 has not
been resolved. The exact phrasing from a recent review: *"it takes hours for the app to
load receipts and sometimes they don't load at all — you would never know unless you
double-checked."* This is the same language from 2024/2025 reviews. TallyShot's
always-visible sync status pill (Slice 6 v1 blocker) directly addresses this.

### No changes to the core TallyShot plan

The session-5 analysis and the six v1 blockers in section H remain the right call.
Session 6 confirms them; it does not add new blockers. The two additions worth noting
are the Elite tier watch-point on SparkReceipt, and the custom-mileage-rate opportunity
on Dext.

---

## I. Sources

### Earlier sessions
- [Expensify on Google Play](https://play.google.com/store/apps/details?id=org.me.mobiexpensifyg)
- [Receipt Scanner: Easy Expense](https://play.google.com/store/apps/details?id=com.easyexpense&hl=en_US)
- [Crunchr Receipt Scanner](https://play.google.com/store/apps/details?id=com.crunchr.app&hl=en)
- [Receipt Scanner by Saldo Apps](https://play.google.com/store/apps/details?id=saldo.receiptscanner.app&hl=en_US)
- [Crunchr features page](https://crunchr.us/features/)
- [Crunchr Capterra reviews](https://www.capterra.ae/reviews/1032628/crunchr)
- [Saldo Apps homepage](https://saldoapps.com/)
- [Best Receipt Apps Australia (Anna Money guide)](https://annamoney.au/blog/guides/best-receipt-app-australia/)
- [Capterra Expensify reviews](https://www.capterra.com/p/97594/Expensify/reviews/)
- [SaaSPricePulse — Expensify True Cost 2026](https://www.saaspricepulse.com/tools/expensify)
- [Easy Expense paywall library on Adapty](https://adapty.io/paywall-library/receipt-scanner-easy-expense/)

### Session 5 — SparkReceipt
- [SparkReceipt on Google Play](https://play.google.com/store/apps/details?id=com.valorbyte.sparkreceipt&hl=en_US)
- [SparkReceipt homepage](https://sparkreceipt.com/)
- [SparkReceipt pricing](https://sparkreceipt.com/pricing/)
- [SparkReceipt for accountants](https://sparkreceipt.com/accountants/)
- [SparkReceipt on Capterra (2026)](https://www.capterra.com/p/10006111/SparkReceipt/)
- [SparkReceipt on G2](https://www.g2.com/products/sparkreceipt/reviews)
- [SparkReceipt on AppSumo](https://appsumo.com/products/sparkreceipt/reviews/)
- [SparkReceipt on Trustpilot](https://www.trustpilot.com/review/sparkreceipt.com)
- [SparkReceipt on SaaSWorthy (April 2026)](https://www.saasworthy.com/product/sparkreceipt)
- [trombonegeek SparkReceipt review (2026)](https://trombonegeek.com/sparkreceipt-review/)

### Session 5 — Dext
- [Dext: Receipt Tracker on Google Play](https://play.google.com/store/apps/details?id=com.receiptbank.android&hl=en_US)
- [Dext mobile app product page](https://dext.com/en/business/product/dext-mobile-app)
- [Dext receipt scanner & tracker product page](https://dext.com/us/business/product/receipts-scanner-tracker-app)
- [Dext business mileage tracking](https://dext.com/us/business/products/mileage-tracking)
- [Dext on Capterra (2026)](https://www.capterra.com/p/160189/Dext/)
- [Dext on G2](https://www.g2.com/products/dext/reviews)
- [Dext on Trustpilot](https://www.trustpilot.com/review/dext.com)
- [Dext on Software Advice (2026)](https://www.softwareadvice.com/accounting/receipt-bank-profile/)
- [Dext mobile-app help (upload paperwork)](https://help.dext.com/en/articles/105670-how-to-use-the-mobile-app-to-upload-paperwork)

### Session 6 — May 2026 verification

#### SparkReceipt
- [SparkReceipt pricing (May 2026)](https://sparkreceipt.com/pricing/)
- [SparkReceipt on Google Play (May 2026)](https://play.google.com/store/apps/details?id=com.valorbyte.sparkreceipt&hl=en_US)
- [SparkReceipt on GetApp (2026)](https://www.getapp.com/finance-accounting-software/a/sparkreceipt/)
- [SparkReceipt on Capterra (2026)](https://www.capterra.com/p/10006111/SparkReceipt/)
- [SparkReceipt on G2 (2026)](https://www.g2.com/products/sparkreceipt/reviews)
- [SparkReceipt on AppSumo (2026)](https://appsumo.com/products/sparkreceipt/reviews/)
- [SparkReceipt on SaaSWorthy (April 2026)](https://www.saasworthy.com/product/sparkreceipt)
- [SparkReceipt review — trombonegeek (2026)](https://trombonegeek.com/sparkreceipt-review/)
- [SparkReceipt review — ruhanirabin (2026)](https://www.ruhanirabin.com/product-review/sparkreceipt-review/)
- [SparkReceipt review — aichief (2026)](https://aichief.com/ai-productivity-tools/sparkreceipt/)

#### Dext
- [Dext on Google Play (2026)](https://play.google.com/store/apps/details?id=com.receiptbank.android&hl=en_US)
- [Dext on Capterra pricing (2026)](https://www.capterra.com/p/160189/Dext/pricing/)
- [Dext on GetApp (2026)](https://www.getapp.com/finance-accounting-software/a/dext/)
- [Dext on SoftwareAdvice (2026)](https://www.softwareadvice.com/accounting/receipt-bank-profile/)
- [Dext on Research.com (2026)](https://research.com/software/reviews/dext)
- [Dext mileage tracking (2026)](https://dext.com/us/business/products/mileage-tracking)
- [Dext mobile app product page (2026)](https://dext.com/en/business/product/receipts-scanner-tracker-app)
